import { useMemo, useState } from 'react';
import { getCalendar } from '../../data/market';
import type { CalendarEvent } from '../../data/types';
import { useAsync } from '../../lib/useAsync';

const SKELETON_ROWS: CalendarEvent[] = [
  { time: '—', title: '—', impact: 'LOW' },
  { time: '—', title: '—', impact: 'LOW' },
  { time: '—', title: '—', impact: 'LOW' },
  { time: '—', title: '—', impact: 'LOW' },
];

export function TodaysEvents() {
  // Today as ISO yyyy-mm-dd; B2-MD will use this when wiring real calendars.
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [highOnly, setHighOnly] = useState(false);

  const { data, loading } = useAsync<CalendarEvent[]>(
    () => getCalendar(today),
    [today],
  );

  const events = data ?? SKELETON_ROWS;
  const filtered = highOnly ? events.filter((e) => e.impact === 'HIGH') : events;

  return (
    <div>
      <div className="row between center">
        <div className="wf-label">Today · Key events</div>
        <button
          type="button"
          onClick={() => setHighOnly((v) => !v)}
          aria-pressed={highOnly}
          className={'chip' + (highOnly ? ' active' : '')}
          style={{
            padding: '2px 6px',
            fontSize: 9,
            cursor: 'pointer',
            color: highOnly ? 'var(--orange)' : 'var(--fg-3)',
            borderColor: highOnly ? 'var(--orange)' : 'var(--hairline)',
            background: 'transparent',
          }}
          title="Show high impact only"
        >
          HIGH
        </button>
      </div>
      <div style={{ marginTop: 8 }} aria-busy={loading}>
        {filtered.map((e, i) => (
          <div
            key={`${e.time}-${e.title}-${i}`}
            className="row gap-2"
            style={{
              padding: '6px 0',
              borderBottom: '1px solid var(--hairline)',
              fontSize: 11,
              opacity: loading && !data ? 0.4 : 1,
            }}
          >
            <span className="wf-mono muted" style={{ width: 40 }}>
              {e.time}
            </span>
            <span style={{ flex: 1, color: 'var(--fg-2)' }}>{e.title}</span>
            <span
              className="tag"
              style={{
                color: e.impact === 'HIGH' ? 'var(--orange)' : 'var(--fg-3)',
                borderColor:
                  e.impact === 'HIGH' ? 'var(--orange)' : 'var(--hairline)',
              }}
            >
              {e.impact}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
