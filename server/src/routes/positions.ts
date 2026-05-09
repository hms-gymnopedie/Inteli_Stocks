/**
 * /api/positions/* — buy-rationale + sell-trigger CRUD — B18.
 *
 *   GET  /                  list all (active + fired)
 *   POST /                  create rationale; body: { symbol, reason,
 *                            entryPrice, triggers[] }
 *   DELETE /:id             remove rationale
 *   POST /check             evaluate all active positions, fire Slack
 *                            for any newly-matched triggers (also
 *                            invoked by jobs/cron.ts hourly)
 */

import { Router, type Request, type Response } from 'express';
import {
  addRationale,
  deleteRationale,
  getRationale,
  listRationales,
  updateRationale,
  type SellTrigger,
} from '../storage/positions.js';
import { evalPositions } from '../lib/positionEval.js';

export const positions = Router();

function isValidTrigger(t: unknown): t is SellTrigger {
  if (!t || typeof t !== 'object') return false;
  const x = t as Record<string, unknown>;
  switch (x.type) {
    case 'date':
      return typeof x.date === 'string' && x.date.length >= 10;
    case 'absoluteAbove':
    case 'absoluteBelow':
      return typeof x.price === 'number' && Number.isFinite(x.price) && x.price > 0;
    case 'pctFromBase':
      return typeof x.basePrice === 'number' && x.basePrice > 0
          && typeof x.pct === 'number' && Number.isFinite(x.pct);
    case 'trailingFromPeak':
      return typeof x.pct === 'number' && Number.isFinite(x.pct) && x.pct < 0
          && typeof x.peakPrice === 'number' && x.peakPrice > 0;
    default:
      return false;
  }
}

positions.get('/', (_req, res) => {
  res.json(listRationales());
});

positions.post('/', (req: Request, res: Response) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const symbol = typeof body.symbol === 'string' ? body.symbol.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
  const entryPrice = typeof body.entryPrice === 'number' ? body.entryPrice : NaN;
  const rawTriggers = Array.isArray(body.triggers) ? body.triggers : [];

  if (!symbol)                       { res.status(400).json({ ok: false, reason: 'missing_symbol' });     return; }
  if (!reason)                       { res.status(400).json({ ok: false, reason: 'missing_reason' });     return; }
  if (!Number.isFinite(entryPrice) || entryPrice <= 0) {
    res.status(400).json({ ok: false, reason: 'missing_entryPrice' });
    return;
  }
  if (rawTriggers.length === 0)      { res.status(400).json({ ok: false, reason: 'missing_triggers' });   return; }

  const triggers: SellTrigger[] = [];
  for (const t of rawTriggers) {
    if (!isValidTrigger(t)) {
      res.status(400).json({ ok: false, reason: 'invalid_trigger', detail: t });
      return;
    }
    triggers.push(t);
  }

  const r = addRationale({ symbol, reason, entryPrice, triggers });
  res.status(201).json(r);
});

positions.put('/:id', (req: Request, res: Response): void => {
  const id = String(req.params.id);
  if (!getRationale(id)) {
    res.status(404).json({ ok: false, reason: 'not_found' });
    return;
  }

  const body = (req.body ?? {}) as Record<string, unknown>;
  const patch: { reason?: string; entryPrice?: number; triggers?: SellTrigger[] } = {};

  if ('reason' in body) {
    if (typeof body.reason !== 'string' || !body.reason.trim()) {
      res.status(400).json({ ok: false, reason: 'missing_reason' }); return;
    }
    patch.reason = body.reason;
  }
  if ('entryPrice' in body) {
    if (typeof body.entryPrice !== 'number' || !Number.isFinite(body.entryPrice) || body.entryPrice <= 0) {
      res.status(400).json({ ok: false, reason: 'missing_entryPrice' }); return;
    }
    patch.entryPrice = body.entryPrice;
  }
  if ('triggers' in body) {
    if (!Array.isArray(body.triggers) || body.triggers.length === 0) {
      res.status(400).json({ ok: false, reason: 'missing_triggers' }); return;
    }
    const triggers: SellTrigger[] = [];
    for (const t of body.triggers) {
      if (!isValidTrigger(t)) {
        res.status(400).json({ ok: false, reason: 'invalid_trigger', detail: t });
        return;
      }
      triggers.push(t);
    }
    patch.triggers = triggers;
  }

  const updated = updateRationale(id, patch);
  if (!updated) { res.status(404).json({ ok: false, reason: 'not_found' }); return; }
  res.json(updated);
});

positions.delete('/:id', (req: Request, res: Response) => {
  const removed = deleteRationale(String(req.params.id));
  if (removed) res.status(204).end();
  else res.status(404).json({ ok: false, reason: 'not_found' });
});

positions.post('/check', async (_req: Request, res: Response) => {
  try {
    const result = await evalPositions();
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'eval_failed', detail: String(err) });
  }
});
