import { Router, type Request, type Response } from 'express';

import {
  type AIProvider,
  defaultModelFor,
  generate,
  getModelsResponse,
  providerConfigured,
  resolveModel,
} from '../providers/registry.js';
import {
  appendAIVerdict,
  appendAIHedge,
  appendAISignals,
  appendAIInsights,
} from '../storage/google-sheets.js';
import {
  type Area,
  appendHedge   as historyAppendHedge,
  appendInsights as historyAppendInsights,
  appendSignals  as historyAppendSignals,
  appendVerdict  as historyAppendVerdict,
  clearArea     as historyClearArea,
  readHistory   as historyRead,
} from '../storage/ai-history.js';

/**
 * /api/ai/* — multi-provider proxy (B2-AI + B2-AI2)
 *
 * Endpoints:
 *   GET  /models                                  → AIModelsResponse
 *   POST /verdict   body { symbol, provider?, model? }     → AIVerdict
 *   POST /hedge     body { exposure, provider?, model? }   → HedgeProposal
 *   GET  /signals?provider=&model=                → SSE stream of AISignal
 *   GET  /insights?portfolioId=&provider=&model=  → SSE stream of AIInsight
 *
 * If the requested provider is not configured (no API key), endpoints respond
 * 503 { ok: false, reason: '<provider>_not_configured' } so the frontend can
 * fall back to mock generators.
 *
 * Caching: Anthropic uses cache_control: ephemeral on the system prompt;
 * Gemini auto-caches identical content blocks server-side.
 */
export const ai = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function notConfigured(res: Response, provider: AIProvider): void {
  res.status(503).json({ ok: false, reason: `${provider}_not_configured` });
}

/** Strip ```json fences and parse. */
function parseJSON<T>(text: string): T {
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i,    '')
    .replace(/```\s*$/,     '')
    .trim();
  return JSON.parse(stripped) as T;
}

/** Pick provider from query/body, default to first configured. */
function pickProvider(raw: unknown): AIProvider {
  const id = typeof raw === 'string' ? raw : '';
  if (id === 'anthropic' || id === 'gemini') return id;
  // Default selection: first configured. If none configured, return 'anthropic'
  // (callers will hit the 503 guard immediately).
  const models = getModelsResponse();
  return models.defaultProvider ?? 'anthropic';
}

function sseHeaders(res: Response): void {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
}

function sseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseDone(res: Response): void {
  res.write('event: done\ndata: {}\n\n');
  res.end();
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

const VERDICT_SYSTEM = `You are a professional equity analyst at an institutional trading desk.
When given a stock symbol, return a structured investment verdict in JSON.

The JSON must match this exact schema:
{
  "symbol": string,
  "verdict": "ACCUMULATE" | "HOLD" | "REDUCE" | "AVOID",
  "riskScore": number (1-5, integer),
  "convictionScore": number (0-100, integer),
  "summary": string (1-2 sentences, max 200 chars),
  "axes": [
    { "label": "MOMENTUM",  "score": number (1-5), "maxScore": 5, "color": "up"|"down"|"accent" },
    { "label": "VALUATION", "score": number (1-5), "maxScore": 5, "color": "up"|"down"|"accent" },
    { "label": "QUALITY",   "score": number (1-5), "maxScore": 5, "color": "up"|"down"|"accent" },
    { "label": "SENTIMENT", "score": number (1-5), "maxScore": 5, "color": "up"|"down"|"accent" },
    { "label": "GEO RISK",  "score": number (1-5), "maxScore": 5, "color": "up"|"down"|"accent" }
  ]
}

Color convention: score 4-5 → "up", score 1-2 → "down", score 3 → "accent".
Return ONLY the JSON object. No explanation, no markdown fences.`;

const HEDGE_SYSTEM = `You are a portfolio risk manager at a hedge fund.
When given a description of portfolio exposure or risk, return a structured hedge proposal in JSON.

The JSON must match this exact schema:
{
  "proposalId": string (generate a short unique id, e.g. "hedge-<3 random chars>"),
  "description": string (2-3 sentences describing the hedge strategy, max 300 chars),
  "expectedDrawdownTrim": string (e.g. "−2.1pp" or "−3.5%"),
  "actions": string[] (2-4 action labels, e.g. ["SIMULATE", "DISMISS"])
}

Return ONLY the JSON object. No explanation, no markdown fences.`;

const SIGNALS_SYSTEM = `You are a markets desk at an institutional trading firm.
Emit short-form actionable signal cards as a JSON array.

Each item must match:
{
  "id":   string (unique short id),
  "type": "SIGNAL" | "CAUTION" | "INFO",
  "when": string (e.g. "4m AGO", "18m AGO"),
  "body": string (1-2 sentences, max 180 chars),
  "tags": string[] (2-3 tags like ["RISK 2/5", "ACTION · ADD"])
}

Return ONLY a JSON array of 3-5 such objects. No explanation, no markdown fences.`;

const INSIGHTS_SYSTEM = `You are a portfolio AI assistant.
Emit insight cards tailored to the user's portfolio as a JSON array.

Each item must match:
{
  "id":      string (unique short id),
  "tag":     "OPPORTUNITY" | "RISK" | "MACRO" | "EARNINGS",
  "when":    string (e.g. "2m ago", "1h ago"),
  "tone":    "orange" | "down" | "fg",
  "title":   string (max 50 chars),
  "body":    string (1-2 sentences, max 200 chars),
  "actions": string[] (1-3 action labels),
  "risk":    string (e.g. "2/5"),
  "score":   number (0-100)
}

Return ONLY a JSON array of 3-5 such objects. No explanation, no markdown fences.`;

// ─── GET /models ─────────────────────────────────────────────────────────────

ai.get('/models', (_req: Request, res: Response) => {
  res.json(getModelsResponse());
});

// ─── POST /verdict ───────────────────────────────────────────────────────────

ai.post('/verdict', async (req: Request, res: Response) => {
  const body = req.body as { symbol?: string; provider?: string; model?: string };
  const provider = pickProvider(body.provider);

  if (!providerConfigured(provider)) { notConfigured(res, provider); return; }
  if (!body.symbol || typeof body.symbol !== 'string') {
    res.status(400).json({ ok: false, reason: 'missing_symbol' });
    return;
  }

  const sym   = body.symbol.trim().toUpperCase();
  const model = resolveModel(provider, body.model);

  try {
    const result = await generate({
      provider,
      model,
      system: VERDICT_SYSTEM,
      user:   `Analyze ${sym} and return the investment verdict JSON.`,
    });
    const data = parseJSON<{
      symbol: string; verdict: string;
      riskScore: number; convictionScore: number;
      summary: string; axes: unknown[];
    }>(result.text);
    const meta = { provider: result.provider, model: result.model, usage: result.usage };
    res.json({ data, meta });
    void appendAIVerdict(data, meta);
    historyAppendVerdict(data, meta);
  } catch (err) {
    console.error('[B2-AI] /verdict error:', err);
    res.status(502).json({ ok: false, reason: 'upstream_error', detail: String(err) });
  }
});

// ─── POST /hedge ─────────────────────────────────────────────────────────────

ai.post('/hedge', async (req: Request, res: Response) => {
  const body = req.body as { exposure?: string; provider?: string; model?: string };
  const provider = pickProvider(body.provider);

  if (!providerConfigured(provider)) { notConfigured(res, provider); return; }
  if (!body.exposure || typeof body.exposure !== 'string') {
    res.status(400).json({ ok: false, reason: 'missing_exposure' });
    return;
  }

  const model = resolveModel(provider, body.model);

  try {
    const exposure = body.exposure.trim();
    const result = await generate({
      provider,
      model,
      system: HEDGE_SYSTEM,
      user:   `Portfolio exposure: ${exposure}\n\nReturn the hedge proposal JSON.`,
    });
    const data = parseJSON<{
      proposalId: string; description: string;
      expectedDrawdownTrim: string; actions: string[];
    }>(result.text);
    const meta = { provider: result.provider, model: result.model, usage: result.usage };
    res.json({ data, meta });
    void appendAIHedge(exposure, data, meta);
    historyAppendHedge(data, exposure, meta);
  } catch (err) {
    console.error('[B2-AI] /hedge error:', err);
    res.status(502).json({ ok: false, reason: 'upstream_error', detail: String(err) });
  }
});

// ─── GET /signals (SSE) ──────────────────────────────────────────────────────

ai.get('/signals', async (req: Request, res: Response) => {
  const provider = pickProvider(req.query.provider);
  if (!providerConfigured(provider)) { notConfigured(res, provider); return; }

  const model = resolveModel(provider, req.query.model as string | undefined);

  sseHeaders(res);
  try {
    const result = await generate({
      provider,
      model,
      system:    SIGNALS_SYSTEM,
      user:      'Emit current market signal cards as a JSON array (3-5 items).',
      maxTokens: 2048,
    });
    const items = parseJSON<unknown[]>(result.text);
    if (!Array.isArray(items)) throw new Error('signals: not an array');
    for (const item of items) sseEvent(res, 'signal', item);
    // Emit a meta event with token usage so the client can show "Used N in / M out".
    const meta = { provider: result.provider, model: result.model, usage: result.usage };
    sseEvent(res, 'meta', meta);
    sseDone(res);
    // Mirror to Sheets after the response is closed (fire-and-forget).
    void appendAISignals(
      items as { id: string; type: 'SIGNAL' | 'CAUTION' | 'INFO';
                 when: string; body: string; tags: string[] }[],
      meta,
    );
    historyAppendSignals(items, meta);
  } catch (err) {
    console.error('[B2-AI] /signals error:', err);
    sseEvent(res, 'error', { message: String(err) });
    res.end();
  }
});

// ─── GET /insights (SSE) ─────────────────────────────────────────────────────

ai.get('/insights', async (req: Request, res: Response) => {
  const provider = pickProvider(req.query.provider);
  if (!providerConfigured(provider)) { notConfigured(res, provider); return; }

  const portfolioId = String(req.query.portfolioId ?? 'default');
  const model       = resolveModel(provider, req.query.model as string | undefined);

  sseHeaders(res);
  try {
    const result = await generate({
      provider,
      model,
      system:    INSIGHTS_SYSTEM,
      user:      `Emit insight cards for portfolio ${portfolioId} as a JSON array (3-5 items).`,
      maxTokens: 2048,
    });
    const items = parseJSON<unknown[]>(result.text);
    if (!Array.isArray(items)) throw new Error('insights: not an array');
    for (const item of items) sseEvent(res, 'insight', item);
    const meta = { provider: result.provider, model: result.model, usage: result.usage };
    sseEvent(res, 'meta', meta);
    sseDone(res);
    void appendAIInsights(
      items as { id: string; tag: string; when: string; tone: string;
                 title: string; body: string; actions: string[];
                 risk: string; score: number }[],
      meta,
    );
    historyAppendInsights(items, meta);
  } catch (err) {
    console.error('[B2-AI] /insights error:', err);
    sseEvent(res, 'error', { message: String(err) });
    res.end();
  }
});

// ─── GET /history ────────────────────────────────────────────────────────────

const VALID_AREAS: ReadonlyArray<Area> = ['signals', 'insights', 'verdicts', 'hedges'];

function parseArea(raw: unknown): Area | null {
  if (typeof raw !== 'string') return null;
  return (VALID_AREAS as readonly string[]).includes(raw) ? (raw as Area) : null;
}

function parseLimit(raw: unknown): number | undefined {
  if (typeof raw !== 'string' || raw === '') return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

ai.get('/history', (req: Request, res: Response) => {
  const limit = parseLimit(req.query.limit);
  const rawArea = req.query.area;

  if (typeof rawArea === 'string' && rawArea.length > 0) {
    const area = parseArea(rawArea);
    if (!area) {
      res.status(400).json({ ok: false, reason: 'invalid_area' });
      return;
    }
    res.json({ area, entries: historyRead(area, limit) });
    return;
  }

  // No area filter — return the full file (optionally limited per-area).
  const full = historyRead();
  if (typeof limit === 'number') {
    res.json({
      signals:  full.signals.slice(-limit),
      insights: full.insights.slice(-limit),
      verdicts: full.verdicts.slice(-limit),
      hedges:   full.hedges.slice(-limit),
    });
    return;
  }
  res.json(full);
});

// ─── DELETE /history/:area ───────────────────────────────────────────────────

ai.delete('/history/:area', (req: Request, res: Response) => {
  const area = parseArea(req.params.area);
  if (!area) {
    res.status(400).json({ ok: false, reason: 'invalid_area' });
    return;
  }
  historyClearArea(area);
  res.status(204).end();
});

// Avoid unused-symbol lint; keep export for callers that may want defaults.
export { defaultModelFor };
