import { Router, type Request, type Response } from 'express';
import { isConfigured, client, DEFAULT_MODEL } from '../providers/anthropic.js';

/**
 * /api/ai/* — owned by B2-AI. Proxies Claude API.
 *
 * Endpoints:
 *   GET  /signals               → SSE stream of AISignal objects
 *   GET  /insights?portfolioId  → SSE stream of AIInsight objects
 *   POST /verdict               → JSON AIVerdict (body: { symbol })
 *   POST /hedge                 → JSON HedgeProposal (body: { exposure })
 *
 * All endpoints respond 503 { ok: false, reason: 'anthropic_not_configured' }
 * when ANTHROPIC_API_KEY is absent.
 *
 * Prompt caching: stable system-prompt content blocks carry
 * cache_control: { type: 'ephemeral' } (claude-api skill pattern).
 * Cache lifetime ~5 min; breakeven ≥ 1024 tokens.
 *
 * Model: claude-opus-4-7 (DEFAULT_MODEL from provider)
 */
export const ai = Router();

// ─── Shared 503 guard ─────────────────────────────────────────────────────────

function notConfigured(res: Response): void {
  res.status(503).json({ ok: false, reason: 'anthropic_not_configured' });
}

// ─── JSON parse helper ────────────────────────────────────────────────────────

/**
 * Try to extract a JSON object from Claude's text response.
 * Claude sometimes wraps JSON in a ```json ... ``` fence — strip it first.
 */
function parseJSON<T>(text: string): T {
  const stripped = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```\s*$/, '')
    .trim();
  return JSON.parse(stripped) as T;
}

// ─── POST /verdict ────────────────────────────────────────────────────────────

/**
 * Returns the AI investment verdict for a stock symbol.
 *
 * Body: { symbol: string }
 * Response: AIVerdict
 *
 * System prompt is marked cache_control: ephemeral so repeated calls for
 * different symbols reuse the cached system context (>1024 tokens threshold).
 */
ai.post('/verdict', async (req: Request, res: Response) => {
  if (!isConfigured()) { notConfigured(res); return; }

  const { symbol } = req.body as { symbol?: string };
  if (!symbol || typeof symbol !== 'string') {
    res.status(400).json({ ok: false, reason: 'missing_symbol' });
    return;
  }

  const sym = symbol.trim().toUpperCase();

  try {
    const message = await client().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `You are a professional equity analyst at an institutional trading desk.
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
Return ONLY the JSON object. No explanation, no markdown fences.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analyze ${sym} and return the investment verdict JSON.`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const verdict = parseJSON(text);
    res.json(verdict);
  } catch (err) {
    console.error('[B2-AI] /verdict error:', err);
    res.status(502).json({ ok: false, reason: 'upstream_error', detail: String(err) });
  }
});

// ─── POST /hedge ──────────────────────────────────────────────────────────────

/**
 * Returns a hedge proposal for a given portfolio exposure description.
 *
 * Body: { exposure: string }
 * Response: HedgeProposal
 */
ai.post('/hedge', async (req: Request, res: Response) => {
  if (!isConfigured()) { notConfigured(res); return; }

  const { exposure } = req.body as { exposure?: string };
  if (!exposure || typeof exposure !== 'string') {
    res.status(400).json({ ok: false, reason: 'missing_exposure' });
    return;
  }

  try {
    const message = await client().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 1024,
      system: [
        {
          type: 'text',
          text: `You are a portfolio risk manager at a hedge fund.
When given a description of portfolio exposure or risk, return a structured hedge proposal in JSON.

The JSON must match this exact schema:
{
  "proposalId": string (generate a short unique id, e.g. "hedge-<3 random chars>"),
  "description": string (2-3 sentences describing the hedge strategy, max 300 chars),
  "expectedDrawdownTrim": string (e.g. "−2.1pp" or "−3.5%"),
  "actions": string[] (2-4 action labels, e.g. ["SIMULATE", "DISMISS"])
}

Return ONLY the JSON object. No explanation, no markdown fences.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Portfolio exposure: ${exposure.trim()}\n\nReturn the hedge proposal JSON.`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '';
    const proposal = parseJSON(text);
    res.json(proposal);
  } catch (err) {
    console.error('[B2-AI] /hedge error:', err);
    res.status(502).json({ ok: false, reason: 'upstream_error', detail: String(err) });
  }
});

// ─── SSE helpers ──────────────────────────────────────────────────────────────

function sseHeaders(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  // Disable Nginx / Express response buffering so each chunk lands immediately.
  res.setHeader('X-Accel-Buffering', 'no');
}

function sseEvent(res: Response, event: string, data: unknown): void {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function sseDone(res: Response): void {
  res.write('event: done\ndata: {}\n\n');
  res.end();
}

// ─── GET /signals ─────────────────────────────────────────────────────────────

/**
 * Streams AI signal cards (Overview right panel) via Server-Sent Events.
 *
 * Calls Claude with streaming enabled; after the full response is collected,
 * emits each parsed AISignal as an individual SSE event, then closes the stream.
 *
 * System prompt is cached (ephemeral) — stable context reused across requests.
 */
ai.get('/signals', async (_req: Request, res: Response) => {
  if (!isConfigured()) { notConfigured(res); return; }

  sseHeaders(res);

  try {
    // Use non-streaming for reliability; emit parsed objects as SSE events.
    // Streaming text-delta parsing for structured JSON is fragile — we get
    // the full response then fan it out as SSE so the frontend still uses
    // EventSource for consumption consistency.
    const message = await client().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 2048,
      system: [
        {
          type: 'text',
          text: `You are a markets desk AI generating actionable signal cards for a Bloomberg-style trading dashboard.
Generate exactly 3 short-form signal cards as a JSON array.

Each card must match this schema:
{
  "id": string (e.g. "sig-001"),
  "type": "SIGNAL" | "CAUTION" | "INFO",
  "when": string (relative time, e.g. "2m AGO" or "15m AGO"),
  "body": string (1-2 sentences, max 180 chars, professional trading desk tone),
  "tags": string[] (2-3 tags, e.g. ["RISK 2/5", "ACTION · ADD"])
}

Reflect real market dynamics: semis, energy, macro rates, FX, and geopolitical risk.
Return ONLY a JSON array. No explanation, no markdown fences.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: 'Generate 3 market signal cards for the current trading session.',
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const signals = parseJSON<unknown[]>(text);

    for (const signal of signals) {
      sseEvent(res, 'signal', signal);
    }
    sseDone(res);
  } catch (err) {
    console.error('[B2-AI] /signals error:', err);
    sseEvent(res, 'error', { reason: 'upstream_error', detail: String(err) });
    res.end();
  }
});

// ─── GET /insights ────────────────────────────────────────────────────────────

/**
 * Streams AI insight cards for the portfolio feed via Server-Sent Events.
 *
 * Query: portfolioId (optional; reserved for multi-portfolio B5)
 * Uses a mock portfolio context for now (real portfolio data lands in B2-MD).
 *
 * System prompt is cached (ephemeral).
 */
ai.get('/insights', async (req: Request, res: Response) => {
  if (!isConfigured()) { notConfigured(res); return; }

  const portfolioId = (req.query.portfolioId as string | undefined) ?? 'default';

  sseHeaders(res);

  // Mock portfolio context injected until B2-MD portfolio adapter is complete.
  const portfolioContext = `Portfolio ID: ${portfolioId}
Holdings snapshot (mock):
- NVDA  8.2%  Tech / Semis
- AAPL  6.1%  Tech / Hardware
- TSM   6.4%  Tech / Semis (Taiwan geo risk)
- MSFT  5.8%  Tech / Cloud
- XLE   4.3%  Energy ETF
- KRW=X 3.1%  FX / KRW exposure
- US10Y 7.2%  Duration / Rates
Portfolio beta: 1.18
Region: 62% US, 18% Korea/Taiwan, 12% Europe, 8% EM`;

  try {
    const message = await client().messages.create({
      model: DEFAULT_MODEL,
      max_tokens: 3072,
      system: [
        {
          type: 'text',
          text: `You are an AI portfolio analyst generating actionable insight cards for a trading dashboard.
Given a portfolio snapshot, generate exactly 4 insight cards covering OPPORTUNITY, RISK, MACRO, and EARNINGS themes.

Each card must match this schema:
{
  "id": string (e.g. "ins-001"),
  "tag": "OPPORTUNITY" | "RISK" | "MACRO" | "EARNINGS",
  "when": string (relative time, e.g. "2m ago"),
  "tone": "orange" | "down" | "fg",
  "title": string (max 50 chars),
  "body": string (2-3 sentences, max 250 chars, quantified where possible),
  "actions": string[] (1-3 action labels, e.g. ["SIMULATE +2%", "IGNORE"]),
  "risk": string (e.g. "3/5"),
  "score": number (0-100, overall opportunity/risk score)
}

Tone convention: OPPORTUNITY → "orange", RISK/EARNINGS → "down" if high risk or "fg" if neutral, MACRO → "fg".
Return ONLY a JSON array of 4 cards. No explanation, no markdown fences.`,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analyze this portfolio and return 4 insight cards:\n\n${portfolioContext}`,
        },
      ],
    });

    const text = message.content[0].type === 'text' ? message.content[0].text : '[]';
    const insights = parseJSON<unknown[]>(text);

    for (const insight of insights) {
      sseEvent(res, 'insight', insight);
    }
    sseDone(res);
  } catch (err) {
    console.error('[B2-AI] /insights error:', err);
    sseEvent(res, 'error', { reason: 'upstream_error', detail: String(err) });
    res.end();
  }
});
