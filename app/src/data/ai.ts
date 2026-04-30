// AI fetchers — signals, insights, hedge proposals, and verdicts.
// B2-AI: all four functions now call the backend at /api/ai/*.
// If the backend responds 503 (ANTHROPIC_API_KEY not configured) or is
// unreachable, each function falls back to the inline mock implementation
// so the UI keeps working locally without an API key.

import { registerStream } from '../lib/fetchStatus';

import type {
  AIInsight,
  AIModelsResponse,
  AIProvider,
  AISignal,
  AIVerdict,
  ConvictionAxis,
  HedgeProposal,
} from './types';

// ─── API base ────────────────────────────────────────────────────────────────

const AI_BASE = '/api/ai';

// ─── Provider/model selection (set by Tweaks panel) ──────────────────────────

let activeProvider: AIProvider | null = null;
let activeModel: string | null = null;

/**
 * Set the active AI provider+model. Tweaks calls this whenever the user
 * changes the selection. All subsequent AI fetchers include these in their
 * requests so the backend dispatches to the right SDK.
 */
export function setActiveAI(provider: AIProvider | null, model: string | null): void {
  activeProvider = provider;
  activeModel    = model;
}

function aiQuery(): string {
  const params = new URLSearchParams();
  if (activeProvider) params.set('provider', activeProvider);
  if (activeModel)    params.set('model', activeModel);
  const qs = params.toString();
  return qs ? `&${qs}` : '';
}

function aiBody(extra: Record<string, unknown>): string {
  const out: Record<string, unknown> = { ...extra };
  if (activeProvider) out.provider = activeProvider;
  if (activeModel)    out.model    = activeModel;
  return JSON.stringify(out);
}

/** Fetch the catalogue of available providers and their models. */
export async function getModels(): Promise<AIModelsResponse> {
  try {
    const res = await fetch(`${AI_BASE}/models`);
    if (!res.ok) throw new Error(`models: HTTP ${res.status}`);
    return (await res.json()) as AIModelsResponse;
  } catch {
    // Backend unreachable — return empty catalogue so UI degrades gracefully.
    return { providers: [], defaultProvider: null };
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets (kept inline as fallback) ─────────────────────────────────

const MOCK_SIGNALS: AISignal[] = [
  {
    id:   'sig-001',
    type: 'SIGNAL',
    when: '4m AGO',
    body: 'Semis breaking +3.2σ above 20D mean. NVDA leads, options skew flipping bullish into earnings window.',
    tags: ['RISK 2/5', 'ACTION · ADD'],
  },
  {
    id:   'sig-002',
    type: 'CAUTION',
    when: '18m AGO',
    body: 'Energy drawdown widens. WTI breaks 50D MA support; geopolitical premium fading. Watch XLE for follow-through.',
    tags: ['RISK 4/5', 'ACTION · TRIM'],
  },
];

const MOCK_INSIGHTS: AIInsight[] = [
  {
    id:      'ins-001',
    tag:     'OPPORTUNITY',
    when:    '2m ago',
    tone:    'orange',
    title:   'Semis breakout signal',
    body:    'NVDA & TSM both crossed 20D EMA on rising volume. Group RSI 68. Add-up to overweight band.',
    actions: ['SIMULATE +2%', 'IGNORE'],
    risk:    '2/5',
    score:   78,
  },
  {
    id:      'ins-002',
    tag:     'RISK',
    when:    '14m ago',
    tone:    'down',
    title:   'Geo · Taiwan tension elevated',
    body:    'Naval activity spike near Strait. Your TSM exposure (6.4%) at risk of −8% drawdown in stress scenario.',
    actions: ['HEDGE PROPOSAL', 'DETAIL ↗'],
    risk:    '4/5',
    score:   41,
  },
  {
    id:      'ins-003',
    tag:     'MACRO',
    when:    '1h ago',
    tone:    'fg',
    title:   'CPI print Thu — positioning',
    body:    'Consensus 3.1% YoY. Your portfolio beta 1.18 — consider trimming duration / adding USD on hot print.',
    actions: ['VIEW SCENARIO'],
    risk:    '3/5',
    score:   56,
  },
  {
    id:      'ins-004',
    tag:     'EARNINGS',
    when:    '3h ago',
    tone:    'orange',
    title:   'NVDA earnings → 14D',
    body:    'IV at 65th percentile. Historic post-print move ±9.2%. Consider trimming 1pp into print or buying protective puts.',
    actions: ['HEDGE', 'KEEP'],
    risk:    '3/5',
    score:   62,
  },
];

const MOCK_VERDICT_NVDA: AIVerdict = {
  symbol:         'NVDA',
  verdict:        'ACCUMULATE',
  riskScore:      3,
  convictionScore: 72,
  summary:
    'Momentum + earnings revisions positive; valuation full but justified by AI capex cycle. Stagger entries below $890 with 6M horizon.',
  axes: [
    { label: 'MOMENTUM',  score: 4, maxScore: 5, color: 'up'     },
    { label: 'VALUATION', score: 2, maxScore: 5, color: 'down'   },
    { label: 'QUALITY',   score: 5, maxScore: 5, color: 'up'     },
    { label: 'SENTIMENT', score: 4, maxScore: 5, color: 'accent' },
    { label: 'GEO RISK',  score: 3, maxScore: 5, color: 'down'   },
  ] as ConvictionAxis[],
};

const MOCK_HEDGE_PROPOSAL: HedgeProposal = {
  proposalId:           'hedge-001',
  description:
    'Reduce semi exposure 4pp; rotate into utilities + USD cash. Hedge with SOXX 6M 5% OTM puts. Expected drawdown trim: −2.1pp.',
  expectedDrawdownTrim: '−2.1pp',
  actions:              ['SIMULATE', 'DISMISS'],
};

// ─── Mock generators (fallback) ───────────────────────────────────────────────

async function* mockSignals(): AsyncIterable<AISignal> {
  for (const signal of MOCK_SIGNALS) {
    await new Promise<void>((r) => setTimeout(r, 1500 + Math.random() * 1500));
    yield signal;
  }
}

async function* mockInsights(_portfolioId: string): AsyncIterable<AIInsight> {
  for (const insight of MOCK_INSIGHTS) {
    await new Promise<void>((r) => setTimeout(r, 1500 + Math.random() * 1500));
    yield insight;
  }
}

// ─── SSE consumer helper ──────────────────────────────────────────────────────

/**
 * Opens an EventSource to a GET SSE endpoint and yields each parsed event
 * payload as an AsyncIterable. Closes when the 'done' event arrives or on error.
 *
 * T        — the type of data yielded per event
 * eventName — SSE event name to listen for (e.g. 'signal' or 'insight')
 */
async function* consumeSSE<T>(url: string, eventName: string): AsyncIterable<T> {
  // EventSource only works in browser environments. In SSR / test contexts
  // where EventSource is absent we fall back to the mock stream (caller handles).
  if (typeof EventSource === 'undefined') return;

  const stream = registerStream(`SSE ${url.split('?')[0]}`);
  const es = new EventSource(url);
  const queue: T[] = [];
  let done = false;
  let error: Error | null = null;
  let firstChunk = true;

  // Resolve / reject handles to wake the async generator
  let resolve: (() => void) | null = null;

  function wake(): void {
    if (resolve) { resolve(); resolve = null; }
  }

  es.addEventListener(eventName, (e: MessageEvent) => {
    try {
      queue.push(JSON.parse((e as MessageEvent).data) as T);
      if (firstChunk) {
        firstChunk = false;
        stream.ok();
      }
      wake();
    } catch {
      // malformed JSON from server — skip
    }
  });

  es.addEventListener('done', () => {
    done = true;
    es.close();
    stream.done();
    wake();
  });

  es.addEventListener('error', () => {
    // EventSource auto-reconnects by spec on connection failure (every ~3s).
    // We never want that here: if the proxy is down or backend 503's, we'd
    // rather fall back to mock once than spam the network. Always close,
    // and guard against the listener firing after we've already closed.
    if (done) return;
    try { es.close(); } catch { /* ignore */ }
    error = new Error(`SSE error on ${url}`);
    done = true;
    stream.error('connection failed');
    wake();
  });

  while (true) {
    // Drain any queued items first
    while (queue.length > 0) {
      yield queue.shift()!;
    }
    if (done) break;
    // Wait for the next event
    await new Promise<void>((r) => { resolve = r; });
  }

  if (error) throw error;
}

// ─── Exported fetchers / generators ──────────────────────────────────────────

/**
 * Streams AI signal cards (overview right panel) as an AsyncIterable.
 * Tries the backend SSE endpoint first; falls back to mock on 503 / network error.
 */
export async function* streamSignals(): AsyncIterable<AISignal> {
  // SSE responses set Cache-Control: no-cache server-side, so no buster needed.
  // A stable URL also lets EventSource's failure-state map cleanly to one
  // close() call instead of N retries.
  const params = new URLSearchParams();
  if (activeProvider) params.set('provider', activeProvider);
  if (activeModel)    params.set('model',    activeModel);
  const qs = params.toString();
  const url = `${AI_BASE}/signals${qs ? `?${qs}` : ''}`;
  // Probe the backend: if it returns 503 (no key), use mock immediately.
  try {
    const probe = await fetch(url, { method: 'HEAD' }).catch(
      () => null,
    );
    // HEAD on SSE endpoint may return 200 or 405 depending on Express version.
    // A 503 means anthropic_not_configured → fallback.
    if (probe && probe.status === 503) {
      yield* mockSignals();
      return;
    }
  } catch {
    yield* mockSignals();
    return;
  }

  try {
    yield* consumeSSE<AISignal>(url, 'signal');
  } catch {
    yield* mockSignals();
  }
}

/**
 * Streams AI insight cards for the portfolio feed as an AsyncIterable.
 * The `portfolioId` parameter is forwarded to the backend for scoping.
 * Falls back to mock on 503 / network error.
 */
export async function* streamInsights(portfolioId: string): AsyncIterable<AIInsight> {
  const url = `${AI_BASE}/insights?portfolioId=${encodeURIComponent(portfolioId)}${aiQuery()}`;

  try {
    const probe = await fetch(url, { method: 'HEAD' }).catch(() => null);
    if (probe && probe.status === 503) {
      yield* mockInsights(portfolioId);
      return;
    }
  } catch {
    yield* mockInsights(portfolioId);
    return;
  }

  try {
    yield* consumeSSE<AIInsight>(url, 'insight');
  } catch {
    yield* mockInsights(portfolioId);
  }
}

/**
 * Returns a hedge proposal for the given geo exposure string.
 * Falls back to mock on 503 / network error.
 */
export async function proposeHedge(exposure: string): Promise<HedgeProposal> {
  try {
    const res = await fetch(`${AI_BASE}/hedge`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    aiBody({ exposure }),
    });
    if (!res.ok) {
      // 503 = not configured; anything else = upstream error → fallback
      return MOCK_HEDGE_PROPOSAL;
    }
    return (await res.json()) as HedgeProposal;
  } catch {
    await delay();
    return MOCK_HEDGE_PROPOSAL;
  }
}

/**
 * Returns the AI investment verdict (conviction score + 5-axis breakdown) for a symbol.
 * Falls back to mock data on 503 / network error.
 * Mock only has full data for NVDA; other symbols get a neutral placeholder.
 */
export async function getVerdict(symbol: string): Promise<AIVerdict> {
  try {
    const res = await fetch(`${AI_BASE}/verdict`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    aiBody({ symbol }),
    });
    if (!res.ok) {
      return mockVerdict(symbol);
    }
    return (await res.json()) as AIVerdict;
  } catch {
    await delay();
    return mockVerdict(symbol);
  }
}

function mockVerdict(symbol: string): AIVerdict {
  if (symbol === 'NVDA') return MOCK_VERDICT_NVDA;
  return {
    symbol,
    verdict:         'HOLD',
    riskScore:       3,
    convictionScore: 50,
    summary:         'Insufficient data for full analysis. Connect real data in B2-MD.',
    axes: [
      { label: 'MOMENTUM',  score: 3, maxScore: 5, color: 'accent' },
      { label: 'VALUATION', score: 3, maxScore: 5, color: 'accent' },
      { label: 'QUALITY',   score: 3, maxScore: 5, color: 'accent' },
      { label: 'SENTIMENT', score: 3, maxScore: 5, color: 'accent' },
      { label: 'GEO RISK',  score: 3, maxScore: 5, color: 'accent' },
    ] as ConvictionAxis[],
  };
}
