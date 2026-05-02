/**
 * Scheduled jobs — B15-4.
 *
 * Daily 9:00 ET (13:00 UTC during DST, 14:00 UTC standard) — runs the
 * Sheets mirror so the user's spreadsheet always has fresh price/risk
 * data even on days they don't open the dashboard. Posts a Slack
 * heartbeat with portfolio summary if SLACK_WEBHOOK_URL is configured.
 *
 * Cron pattern (UTC):  '0 13 * * 1-5'  (weekdays 13:00 UTC ≈ 9:00 ET DST)
 *
 * Toggle by setting CRON_DAILY_SYNC=off in .env (default: on).
 *
 * Each registered job is wrapped in try/catch so a failure in one
 * doesn't prevent the next from running.
 */

import cron from 'node-cron';
import { localStore } from '../storage/local.js';
import { mirrorToSheets } from '../storage/google-sheets.js';
import * as slack from '../providers/slack.js';

let _started = false;

export function startCronJobs(): void {
  if (_started) return;
  if (process.env.CRON_DAILY_SYNC?.trim().toLowerCase() === 'off') {
    console.log('[cron] CRON_DAILY_SYNC=off — skipping scheduled jobs');
    return;
  }
  _started = true;

  // Mon-Fri 13:00 UTC = 09:00 ET (during US DST). Standard time = 08:00 ET.
  // Acceptable drift; markets open at 09:30 ET so this fires before the bell.
  cron.schedule('0 13 * * 1-5', async () => {
    console.log('[cron] daily-sync firing');
    await runDailySync().catch((err) => {
      console.error('[cron] daily-sync failed:', err);
    });
  }, { timezone: 'UTC' });

  console.log('[cron] scheduled daily-sync (Mon-Fri 13:00 UTC)');
}

async function runDailySync(): Promise<void> {
  const startedAt = Date.now();

  // 1. Push current portfolio to Google Sheets (single-flight; the mirror
  // returns {ok:false, reason:'no_spreadsheet'} when not configured).
  let mirrorResult = '';
  try {
    const store = await localStore.read(null);
    const r = await mirrorToSheets(store);
    mirrorResult = r.ok ? `Sheets ✅ ${new Date(r.syncedAt).toISOString()}` : `Sheets — ${r.reason}`;
  } catch (err) {
    mirrorResult = `Sheets ❌ ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. Slack heartbeat with summary (only if configured).
  if (slack.isConfigured()) {
    try {
      const store = await localStore.read(null);
      const s = store.summary;
      const lines = [
        '*InteliStock daily heartbeat*',
        `${new Date().toISOString().slice(0, 10)} · ${mirrorResult}`,
        '',
        `NAV ${s.navFormatted}  ·  Day ${s.dayChange} (${s.dayChangePct})`,
        `YTD ${s.ytd}  ·  1Y ${s.oneYear}  ·  Sharpe ${s.sharpe}`,
      ];
      await slack.send({
        text: 'InteliStock daily heartbeat',
        blocks: [{ type: 'section', text: { type: 'mrkdwn', text: lines.join('\n') } }],
      });
    } catch (err) {
      console.error('[cron] slack heartbeat failed:', err);
    }
  }

  console.log(`[cron] daily-sync done in ${Date.now() - startedAt}ms · ${mirrorResult}`);
}
