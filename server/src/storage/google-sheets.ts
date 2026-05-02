/**
 * Google Sheets mirror — B5-GS
 *
 * One-way append-only mirror of `PortfolioStore` + AI generation events into
 * the user's Google Sheets file. JSON (~/.intelistock/portfolio.json) remains
 * the source of truth for portfolio state; this module just appends a new
 * snapshot block after every successful local write so the spreadsheet
 * accumulates a full history.
 *
 * Append semantics (the `appendTab` helper):
 *   1. Read the first cell. If the sheet is empty, write the header row.
 *   2. Append the data rows below whatever's already in the sheet.
 * Existing rows are never deleted, so users can scroll back through prior
 * snapshots / AI calls.
 *
 * Tab layout (one tab per array, plus Summary; AI tabs grow as calls happen):
 *   Summary           — one row per sync, full KPI block flattened
 *   Holdings          — N rows per sync, one per holding
 *   Allocation_Sector — N rows per sync, one per slice
 *   Allocation_Region — same
 *   Allocation_Asset  — same
 *   Trades            — N rows per sync, one per trade
 *   RiskFactors       — N rows per sync
 *   Watchlist_KR      — N rows per sync
 *
 *   AI_Signals        — N rows per /signals call (one per signal item)
 *   AI_Insights       — N rows per /insights call (one per insight)
 *   AI_Verdicts       — 1 row per /verdict call
 *   AI_Hedges         — 1 row per /hedge call
 *
 * The leftmost column on every row is `synced_at` (ISO 8601, UTC) so the
 * spreadsheet is its own timeline.
 *
 * Failure handling: every error captured in StorageConfig.lastSyncError and
 * logged; nothing throws back to the caller, so a Sheets outage doesn't
 * break local-file writes or AI responses.
 */

import type { sheets_v4 } from 'googleapis';
import * as google from '../providers/google.js';
import { readConfig, writeConfig } from './config.js';
import type { PortfolioStore } from './types.js';

// ─── Sheet tab names ────────────────────────────────────────────────────────

const TAB_SUMMARY     = 'Summary';
const TAB_HOLDINGS    = 'Holdings';
const TAB_ALLOC_SEC   = 'Allocation_Sector';
const TAB_ALLOC_REG   = 'Allocation_Region';
const TAB_ALLOC_AST   = 'Allocation_Asset';
const TAB_TRADES      = 'Trades';
const TAB_RISK        = 'RiskFactors';
const TAB_WATCH_KR    = 'Watchlist_KR';

const TAB_AI_SIGNALS  = 'AI_Signals';
const TAB_AI_INSIGHTS = 'AI_Insights';
const TAB_AI_VERDICTS = 'AI_Verdicts';
const TAB_AI_HEDGES   = 'AI_Hedges';

const REQUIRED_TABS = [
  TAB_SUMMARY, TAB_HOLDINGS,
  TAB_ALLOC_SEC, TAB_ALLOC_REG, TAB_ALLOC_AST,
  TAB_TRADES, TAB_RISK, TAB_WATCH_KR,
  TAB_AI_SIGNALS, TAB_AI_INSIGHTS, TAB_AI_VERDICTS, TAB_AI_HEDGES,
] as const;

// ─── Headers ────────────────────────────────────────────────────────────────

type Row = (string | number)[];

const SUMMARY_HEADER: Row = [
  'synced_at', 'nav', 'navFormatted', 'dayChange', 'dayChangePct',
  'ytd', 'oneYear', 'sharpe', 'exposure', 'exposureNote',
  'riskScore', 'riskNote', 'drawdown', 'drawdownNote',
];
const HOLDINGS_HEADER: Row = [
  'synced_at', 'symbol', 'name', 'weight', 'price', 'dayPct', 'plPct', 'sparkSeed', 'risk',
];
const ALLOCATION_HEADER: Row = ['synced_at', 'name', 'value'];
const TRADES_HEADER: Row = [
  'synced_at', 'date', 'symbol', 'side', 'quantity', 'price', 'currency',
];
const RISK_HEADER: Row = ['synced_at', 'name', 'value', 'contribution'];
const WATCHLIST_HEADER: Row = [
  'synced_at', 'code', 'name', 'change', 'seed', 'direction',
];

const AI_SIGNAL_HEADER: Row = [
  'synced_at', 'provider', 'model', 'id', 'type', 'when', 'body', 'tags',
  'input_tokens', 'output_tokens', 'cached_read', 'cached_write',
];
const AI_INSIGHT_HEADER: Row = [
  'synced_at', 'provider', 'model', 'id', 'tag', 'when', 'tone',
  'title', 'body', 'actions', 'risk', 'score',
  'input_tokens', 'output_tokens', 'cached_read', 'cached_write',
];
const AI_VERDICT_HEADER: Row = [
  'synced_at', 'provider', 'model', 'symbol', 'verdict',
  'riskScore', 'convictionScore', 'summary', 'axes',
  'input_tokens', 'output_tokens', 'cached_read', 'cached_write',
];
const AI_HEDGE_HEADER: Row = [
  'synced_at', 'provider', 'model', 'exposure', 'proposalId',
  'description', 'expectedDrawdownTrim', 'actions',
  'input_tokens', 'output_tokens', 'cached_read', 'cached_write',
];

// ─── Row builders (portfolio) ───────────────────────────────────────────────

function summaryRows(s: PortfolioStore['summary'], at: string): Row[] {
  return [[
    at, s.nav, s.navFormatted, s.dayChange, s.dayChangePct,
    s.ytd, s.oneYear, s.sharpe, s.exposure, s.exposureNote,
    s.riskScore, s.riskNote, s.drawdown, s.drawdownNote,
  ]];
}

function holdingsRows(h: PortfolioStore['holdings'], at: string): Row[] {
  return h.map((r): Row => [
    at, r.symbol, r.name, r.weight, r.price, r.dayPct, r.plPct, r.sparkSeed, r.risk,
  ]);
}

function allocationRows(a: PortfolioStore['allocation']['sector'], at: string): Row[] {
  return a.map((r): Row => [at, r.name, r.v]);
}

function tradesRows(t: PortfolioStore['trades'], at: string): Row[] {
  return t.map((r): Row => [at, r.date, r.symbol, r.side, r.quantity, r.price, r.currency]);
}

function riskRows(r: PortfolioStore['riskFactors'], at: string): Row[] {
  return r.map((x): Row => [at, x.name, x.value, x.contribution]);
}

function watchlistRows(w: PortfolioStore['watchlist']['KR'], at: string): Row[] {
  return w.map((r): Row => [at, r.code, r.name, r.change, r.seed, r.direction]);
}

// ─── Tab management ─────────────────────────────────────────────────────────

/**
 * Adds any tabs that are required but missing. Idempotent — safe to call on
 * every sync. Returns the resulting set of tab titles.
 */
async function ensureTabs(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<Set<string>> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const existing = new Set(
    (meta.data.sheets ?? [])
      .map((s) => s.properties?.title)
      .filter((t): t is string => Boolean(t)),
  );

  const toAdd = REQUIRED_TABS.filter((t) => !existing.has(t));
  if (toAdd.length === 0) return existing;

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: toAdd.map((title) => ({ addSheet: { properties: { title } } })),
    },
  });
  toAdd.forEach((t) => existing.add(t));
  return existing;
}

/**
 * Append data rows to a tab without overwriting anything that's already there.
 * If the tab is empty, the header row is inserted first; otherwise data is
 * appended at the next free row below the existing table.
 */
async function appendTab(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  tabName: string,
  header: Row,
  dataRows: Row[],
): Promise<void> {
  if (dataRows.length === 0) return;

  // Check whether A1 already has content.
  const probe = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A1:A1`,
  });
  const isEmpty = !probe.data.values || probe.data.values.length === 0;

  const values = isEmpty ? [header, ...dataRows] : dataRows;

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A1`,
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: { values },
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

export interface MirrorResult {
  ok: true;
  syncedAt: number;
  spreadsheetId: string;
}

export interface MirrorSkipped {
  ok: false;
  reason: 'not_configured' | 'not_connected' | 'no_spreadsheet' | 'error';
  detail?: string;
}

/**
 * Append a full PortfolioStore snapshot to the configured spreadsheet. Returns
 * `{ ok: false }` synchronously when prerequisites are missing.
 *
 * Each call appends fresh rows to all 8 portfolio tabs — historical rows are
 * preserved indefinitely. Use the leftmost `synced_at` column to filter or
 * pivot in Sheets.
 */
export async function mirrorToSheets(
  store: PortfolioStore,
): Promise<MirrorResult | MirrorSkipped> {
  if (!google.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!google.isConnected())  return { ok: false, reason: 'not_connected' };

  const cfg = readConfig();
  if (!cfg.spreadsheetId) return { ok: false, reason: 'no_spreadsheet' };

  try {
    const sheets = google.sheetsClient();
    await ensureTabs(sheets, cfg.spreadsheetId);

    const at = new Date().toISOString();

    await appendTab(sheets, cfg.spreadsheetId, TAB_SUMMARY,   SUMMARY_HEADER,    summaryRows(store.summary, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_HOLDINGS,  HOLDINGS_HEADER,   holdingsRows(store.holdings, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_ALLOC_SEC, ALLOCATION_HEADER, allocationRows(store.allocation.sector, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_ALLOC_REG, ALLOCATION_HEADER, allocationRows(store.allocation.region, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_ALLOC_AST, ALLOCATION_HEADER, allocationRows(store.allocation.asset, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_TRADES,    TRADES_HEADER,     tradesRows(store.trades, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_RISK,      RISK_HEADER,       riskRows(store.riskFactors, at));
    await appendTab(sheets, cfg.spreadsheetId, TAB_WATCH_KR,  WATCHLIST_HEADER,  watchlistRows(store.watchlist.KR, at));

    const syncedAt = Date.now();
    writeConfig({ lastSyncAt: syncedAt, lastSyncError: null });
    return { ok: true, syncedAt, spreadsheetId: cfg.spreadsheetId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    writeConfig({ lastSyncError: detail });
    console.error('[google-sheets] mirror failed:', detail);
    return { ok: false, reason: 'error', detail };
  }
}

// ─── AI generation appends ──────────────────────────────────────────────────

/**
 * Token-usage metadata emitted alongside every AI generation. Mirrors the
 * shape returned by providers/registry.ts `generate()`.
 */
export interface AIGenerationMeta {
  provider: string;
  model: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedReadTokens?: number;
    cachedWriteTokens?: number;
  };
}

interface AISignalItem {
  id: string;
  type: 'SIGNAL' | 'CAUTION' | 'INFO';
  when: string;
  body: string;
  tags: string[];
}

interface AIInsightItem {
  id: string;
  tag: string;     // OPPORTUNITY | RISK | MACRO | EARNINGS
  when: string;
  tone: string;    // orange | down | fg
  title: string;
  body: string;
  actions: string[];
  risk: string;
  score: number;
}

interface AIVerdictItem {
  symbol: string;
  verdict: string;
  riskScore: number;
  convictionScore: number;
  summary: string;
  axes: unknown[];
}

interface AIHedgeItem {
  proposalId: string;
  description: string;
  expectedDrawdownTrim: string;
  actions: string[];
}

/**
 * Skip / fail reasons mirror MirrorSkipped above.
 */
async function appendAIRows(
  tabName: string,
  header: Row,
  rows: Row[],
): Promise<MirrorResult | MirrorSkipped> {
  if (!google.isConfigured()) return { ok: false, reason: 'not_configured' };
  if (!google.isConnected())  return { ok: false, reason: 'not_connected' };
  const cfg = readConfig();
  if (!cfg.spreadsheetId) return { ok: false, reason: 'no_spreadsheet' };

  try {
    const sheets = google.sheetsClient();
    await ensureTabs(sheets, cfg.spreadsheetId);
    await appendTab(sheets, cfg.spreadsheetId, tabName, header, rows);
    const syncedAt = Date.now();
    writeConfig({ lastSyncAt: syncedAt, lastSyncError: null });
    return { ok: true, syncedAt, spreadsheetId: cfg.spreadsheetId };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    writeConfig({ lastSyncError: detail });
    console.error(`[google-sheets] ${tabName} append failed:`, detail);
    return { ok: false, reason: 'error', detail };
  }
}

/** Append a single /verdict result row. */
export async function appendAIVerdict(
  v: AIVerdictItem,
  meta: AIGenerationMeta,
): Promise<MirrorResult | MirrorSkipped> {
  const at = new Date().toISOString();
  const u = meta.usage;
  const row: Row = [
    at, meta.provider, meta.model,
    v.symbol, v.verdict, v.riskScore, v.convictionScore,
    v.summary, JSON.stringify(v.axes ?? []),
    u.inputTokens, u.outputTokens,
    u.cachedReadTokens ?? 0, u.cachedWriteTokens ?? 0,
  ];
  return appendAIRows(TAB_AI_VERDICTS, AI_VERDICT_HEADER, [row]);
}

/** Append a single /hedge result row. */
export async function appendAIHedge(
  exposure: string,
  h: AIHedgeItem,
  meta: AIGenerationMeta,
): Promise<MirrorResult | MirrorSkipped> {
  const at = new Date().toISOString();
  const u = meta.usage;
  const row: Row = [
    at, meta.provider, meta.model,
    exposure, h.proposalId, h.description, h.expectedDrawdownTrim,
    (h.actions ?? []).join(' | '),
    u.inputTokens, u.outputTokens,
    u.cachedReadTokens ?? 0, u.cachedWriteTokens ?? 0,
  ];
  return appendAIRows(TAB_AI_HEDGES, AI_HEDGE_HEADER, [row]);
}

/** Append all signals from one /signals SSE call as a single batch. */
export async function appendAISignals(
  items: AISignalItem[],
  meta: AIGenerationMeta,
): Promise<MirrorResult | MirrorSkipped> {
  if (items.length === 0) return { ok: false, reason: 'no_spreadsheet' };
  const at = new Date().toISOString();
  const u = meta.usage;
  const rows: Row[] = items.map((s): Row => [
    at, meta.provider, meta.model,
    s.id, s.type, s.when, s.body, (s.tags ?? []).join(' | '),
    u.inputTokens, u.outputTokens,
    u.cachedReadTokens ?? 0, u.cachedWriteTokens ?? 0,
  ]);
  return appendAIRows(TAB_AI_SIGNALS, AI_SIGNAL_HEADER, rows);
}

/** Append all insights from one /insights SSE call as a single batch. */
export async function appendAIInsights(
  items: AIInsightItem[],
  meta: AIGenerationMeta,
): Promise<MirrorResult | MirrorSkipped> {
  if (items.length === 0) return { ok: false, reason: 'no_spreadsheet' };
  const at = new Date().toISOString();
  const u = meta.usage;
  const rows: Row[] = items.map((i): Row => [
    at, meta.provider, meta.model,
    i.id, i.tag, i.when, i.tone, i.title, i.body,
    (i.actions ?? []).join(' | '), i.risk, i.score,
    u.inputTokens, u.outputTokens,
    u.cachedReadTokens ?? 0, u.cachedWriteTokens ?? 0,
  ]);
  return appendAIRows(TAB_AI_INSIGHTS, AI_INSIGHT_HEADER, rows);
}

// ─── Spreadsheet creation / lookup (unchanged from B5-GS init) ──────────────

export async function createSpreadsheet(): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  title: string;
}> {
  const sheets = google.sheetsClient();
  const today = new Date().toISOString().slice(0, 10);
  const title = `InteliStock Portfolio (${today})`;

  const created = await sheets.spreadsheets.create({
    requestBody: { properties: { title } },
  });
  const spreadsheetId = created.data.spreadsheetId;
  if (!spreadsheetId) throw new Error('Sheets API returned no spreadsheetId.');

  const spreadsheetUrl =
    created.data.spreadsheetUrl ??
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

  // Add all required tabs up front so they're visible immediately.
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: REQUIRED_TABS.map((tabTitle) => ({
        addSheet: { properties: { title: tabTitle } },
      })),
    },
  });

  return { spreadsheetId, spreadsheetUrl, title };
}

export async function lookupSpreadsheet(
  spreadsheetId: string,
): Promise<{ title: string; spreadsheetUrl: string }> {
  const sheets = google.sheetsClient();
  const meta = await sheets.spreadsheets.get({ spreadsheetId });
  const title = meta.data.properties?.title ?? '(untitled)';
  const spreadsheetUrl =
    meta.data.spreadsheetUrl ??
    `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;
  return { title, spreadsheetUrl };
}

export function extractSpreadsheetId(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  const m = /\/spreadsheets\/d\/([a-zA-Z0-9_-]{20,})/.exec(trimmed);
  if (m) return m[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed;
  return null;
}
