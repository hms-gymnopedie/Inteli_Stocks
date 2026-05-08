/**
 * Position rationale + sell-trigger data layer — B18.
 *
 * Wraps /api/positions endpoints. The shape mirrors server/src/storage/
 * positions.ts; keep them in sync.
 */

export type SellTrigger =
  | { type: 'date';             date: string }
  | { type: 'absoluteAbove';    price: number }
  | { type: 'absoluteBelow';    price: number }
  | { type: 'pctFromBase';      basePrice: number; pct: number }
  | { type: 'trailingFromPeak'; pct: number; peakPrice: number };

export interface PositionRationale {
  id:           string;
  symbol:       string;
  reason:       string;
  entryPrice:   number;
  createdAt:    number;
  triggers:     SellTrigger[];
  firedAt:      number | null;
  firedTrigger: SellTrigger | null;
  notified:     boolean;
}

export interface CreateRationaleInput {
  symbol:     string;
  reason:     string;
  entryPrice: number;
  triggers:   SellTrigger[];
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`API ${init?.method ?? 'GET'} ${path} → ${res.status} ${text}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export async function listPositions(): Promise<PositionRationale[]> {
  return api<PositionRationale[]>('/positions');
}

export async function addPosition(p: CreateRationaleInput): Promise<PositionRationale> {
  return api<PositionRationale>('/positions', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(p),
  });
}

export async function deletePosition(id: string): Promise<void> {
  await api<void>(`/positions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export interface CheckResult {
  ok: true;
  total: number;
  fired: number;
  notified: number;
  symbols: string[];
  errors: string[];
}

export async function checkPositions(): Promise<CheckResult> {
  return api<CheckResult>('/positions/check', { method: 'POST' });
}
