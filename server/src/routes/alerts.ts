/**
 * /api/alerts/* — threshold-based portfolio alerts via Slack — B15-3.
 *
 * Endpoints:
 *   POST /test            Send a test message to verify webhook wiring.
 *   POST /portfolio       Evaluate current portfolio summary against
 *                         user thresholds and post alerts when triggered.
 *
 * The endpoint is intended to be called by a scheduler (B15-4 cron) or
 * by the user manually via Settings panel.
 *
 * Triggers (configurable later via Settings):
 *   - day P&L beyond ± THRESHOLD_DAY_PCT (default 2%)
 *   - drawdown beyond − THRESHOLD_DD_PCT  (default 8%)
 */

import { Router, type Request, type Response } from 'express';
import * as slack from '../providers/slack.js';
import { localStore } from '../storage/local.js';
import { computeRiskFactors } from '../lib/factors.js';

export const alerts = Router();

const THRESHOLD_DAY_PCT = 2;
const THRESHOLD_DD_PCT  = 8;

alerts.post('/test', async (_req: Request, res: Response) => {
  if (!slack.isConfigured()) {
    res.status(503).json({ ok: false, reason: 'slack_not_configured' });
    return;
  }
  const r = await slack.send({
    text: 'InteliStock test alert — your Slack webhook is wired correctly.',
    blocks: [
      { type: 'section', text: { type: 'mrkdwn', text: '*InteliStock test alert*\nWebhook is wired correctly. ✅' } },
    ],
  });
  res.status(r.ok ? 200 : 502).json(r);
});

alerts.post('/portfolio', async (req: Request, res: Response) => {
  if (!slack.isConfigured()) {
    res.status(503).json({ ok: false, reason: 'slack_not_configured' });
    return;
  }

  // Allow caller to override thresholds.
  const body = (req.body ?? {}) as { dayPct?: number; ddPct?: number };
  const tDay = typeof body.dayPct === 'number' ? body.dayPct : THRESHOLD_DAY_PCT;
  const tDD  = typeof body.ddPct  === 'number' ? body.ddPct  : THRESHOLD_DD_PCT;

  try {
    const store = await localStore.read(null);
    const summary = store.summary;

    // Parse "+1.74%" or "−4.10%" → number.
    const parsePct = (s: string): number => {
      const m = /([+\-−]?\s*[\d.]+)/.exec(s);
      if (!m) return 0;
      return Number(m[1].replace('−', '-').replace(/\s+/g, ''));
    };
    const dayPct = parsePct(summary.dayChangePct);
    const ddPct  = parsePct(summary.drawdown);

    const triggers: string[] = [];
    if (Math.abs(dayPct) >= tDay) {
      triggers.push(`Day move ${dayPct >= 0 ? '+' : ''}${dayPct.toFixed(2)}% (threshold ±${tDay}%)`);
    }
    if (ddPct <= -tDD) {
      triggers.push(`Drawdown ${ddPct.toFixed(2)}% (threshold −${tDD}%)`);
    }

    if (triggers.length === 0) {
      res.json({ ok: true, sent: false, reason: 'within_thresholds' });
      return;
    }

    // Compose alert. Include top concentration risk for context.
    const factors = await computeRiskFactors(store.holdings).catch(() => []);
    const sectorLine = factors.find((f) => f.name.startsWith('Sector ·'));
    const fxLine     = factors.find((f) => f.name.startsWith('FX ·'));

    const lines = [
      `*InteliStock alert — ${triggers.length === 1 ? '1 trigger' : `${triggers.length} triggers`}*`,
      ...triggers.map((t) => `• ${t}`),
      '',
      `NAV: ${summary.navFormatted}  ·  Day: ${summary.dayChange} (${summary.dayChangePct})`,
      `Drawdown: ${summary.drawdown} ${summary.drawdownNote ? `(${summary.drawdownNote})` : ''}`,
    ];
    if (sectorLine) lines.push(`Concentration: ${sectorLine.name} ${sectorLine.contribution}`);
    if (fxLine)     lines.push(`FX exposure:  ${fxLine.name} ${fxLine.contribution}`);

    const r = await slack.send({
      text: triggers.join(' · '),
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }],
    });

    res.status(r.ok ? 200 : 502).json({ ...r, sent: true, triggers });
  } catch (err) {
    res.status(500).json({ ok: false, reason: 'alert_failed', detail: String(err) });
  }
});
