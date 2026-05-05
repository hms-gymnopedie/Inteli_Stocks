/**
 * Timezone-aware ISO 8601 formatter — B16-tz.
 *
 * `new Date().toISOString()` always emits UTC ('…Z'), which is annoying
 * when the user reads the synced_at column in their local timezone.
 * `formatISOInTZ(date, tz)` returns the same instant rendered as ISO
 * with the proper offset, e.g. '2026-05-04T13:04:08-04:00' for ET.
 *
 * Default timezone comes from process.env.TIMEZONE (default
 * 'America/New_York'). Sheets / Excel both treat the offset-stamped
 * ISO as a real datetime — so sorting + formula chronology still work,
 * and the displayed wall-clock matches the user's region.
 */

export function defaultTZ(): string {
  return process.env.TIMEZONE?.trim() || 'America/New_York';
}

/**
 * Format a Date as ISO 8601 with the given IANA timezone offset.
 * Falls back to UTC ISO on Intl unavailability.
 */
export function formatISOInTZ(date: Date = new Date(), tz: string = defaultTZ()): string {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(date);
    const v = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((p) => p.type === type)?.value ?? '';
    let hour = v('hour');
    if (hour === '24') hour = '00'; // some locales emit '24' for midnight
    const localISO =
      `${v('year')}-${v('month')}-${v('day')}T${hour}:${v('minute')}:${v('second')}`;
    const offset = tzOffset(date, tz);
    return `${localISO}${offset}`;
  } catch {
    return date.toISOString();
  }
}

/** Return the timezone offset suffix (e.g. '-04:00') for `date` in `tz`. */
function tzOffset(date: Date, tz: string): string {
  // Same trick as `Intl.DateTimeFormat`-based offset libraries:
  //   compare the wall-clock as rendered in tz with the wall-clock as
  //   rendered in UTC — the difference is the offset.
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(date);
  const v = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const tzAsUTC = Date.UTC(
    v('year'), v('month') - 1, v('day'),
    v('hour') === 24 ? 0 : v('hour'),
    v('minute'), v('second'),
  );
  const offsetMin = Math.round((tzAsUTC - date.getTime()) / 60_000);
  const sign = offsetMin >= 0 ? '+' : '-';
  const abs = Math.abs(offsetMin);
  const h = String(Math.floor(abs / 60)).padStart(2, '0');
  const m = String(abs % 60).padStart(2, '0');
  return `${sign}${h}:${m}`;
}
