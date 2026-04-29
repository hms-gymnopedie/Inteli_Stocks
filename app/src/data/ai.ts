// AI mock fetchers — signals, insights, hedge proposals, and verdicts.
// Data lifted from Overview.tsx (signals) and Portfolio.tsx (insights).
// All stream functions are finite AsyncIterable generators; real Claude API
// streaming will be added in B2-AI and B3-*-AI.

import type {
  AIInsight,
  AISignal,
  AIVerdict,
  ConvictionAxis,
  HedgeProposal,
} from './types';

// ─── Helper ───────────────────────────────────────────────────────────────────

function delay(): Promise<void> {
  return new Promise((r) => setTimeout(r, 50 + Math.random() * 100));
}

// ─── Mock datasets ────────────────────────────────────────────────────────────

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
  convictionScore:72,
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

// ─── Exported fetchers / generators ──────────────────────────────────────────

/**
 * Streams AI signal cards (overview right panel) as an AsyncIterable.
 * Yields each signal with a 1500–3000ms gap, then ends.
 * B3-OV-AI will replace this with a real Claude API call.
 */
export async function* streamSignals(): AsyncIterable<AISignal> {
  for (const signal of MOCK_SIGNALS) {
    const gap = 1500 + Math.random() * 1500;
    await new Promise<void>((r) => setTimeout(r, gap));
    yield signal;
  }
}

/**
 * Streams AI insight cards for the portfolio feed as an AsyncIterable.
 * The `portfolioId` parameter is reserved for multi-portfolio support in B5.
 * Yields each insight with a 1500–3000ms gap, then ends.
 * B3-PF-AI will replace this with a real Claude API call.
 */
export async function* streamInsights(_portfolioId: string): AsyncIterable<AIInsight> {
  for (const insight of MOCK_INSIGHTS) {
    const gap = 1500 + Math.random() * 1500;
    await new Promise<void>((r) => setTimeout(r, gap));
    yield insight;
  }
}

/**
 * Returns a hedge proposal for the given geo exposure string.
 * B3-GE-AI will replace this with a Claude API call with prompt caching.
 */
export async function proposeHedge(_exposure: string): Promise<HedgeProposal> {
  await delay();
  return MOCK_HEDGE_PROPOSAL;
}

/**
 * Returns the AI investment verdict (conviction score + 5-axis breakdown) for a symbol.
 * Mock only has data for NVDA; other symbols get a neutral placeholder.
 * B3-DT-AI will replace this with a Claude API call.
 */
export async function getVerdict(symbol: string): Promise<AIVerdict> {
  await delay();
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
