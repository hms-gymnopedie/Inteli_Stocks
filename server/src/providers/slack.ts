/**
 * Slack incoming-webhook provider — B15-3.
 *
 * Posts arbitrary text or block-kit messages to a Slack channel via the
 * webhook URL stored in `SLACK_WEBHOOK_URL`. No SDK dependency — just a
 * simple POST. Set the webhook URL via the Settings → API Keys panel.
 *
 * isConfigured() → true when SLACK_WEBHOOK_URL is non-empty.
 */

export function isConfigured(): boolean {
  return Boolean(process.env.SLACK_WEBHOOK_URL?.trim());
}

export function reset(): void {
  /* no client-side cache to clear */
}

export interface SlackBlock {
  type: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [k: string]: any;
}

export interface SlackPayload {
  text:    string;
  blocks?: SlackBlock[];
}

/**
 * Sends a message to the configured Slack webhook. Returns the upstream
 * status code (200 on success). Caller is expected to log failures.
 *
 * Throws when SLACK_WEBHOOK_URL is missing — guard with isConfigured()
 * first.
 */
export async function send(payload: SlackPayload): Promise<{ ok: boolean; status: number; detail?: string }> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) throw new Error('SLACK_WEBHOOK_URL not set');
  try {
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, status: res.status, detail };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return { ok: false, status: 0, detail: err instanceof Error ? err.message : String(err) };
  }
}
