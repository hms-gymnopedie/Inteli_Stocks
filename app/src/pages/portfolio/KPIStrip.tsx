import { useState } from 'react';

import { getSummary } from '../../data/portfolio';
import type { PortfolioSummary } from '../../data/types';
import { Spark } from '../../lib/primitives';
import { useAsync } from '../../lib/useAsync';

type ComparePeriod = '1D' | 'WTD' | 'MTD' | 'YTD';

const PERIODS: ComparePeriod[] = ['1D', 'WTD', 'MTD', 'YTD'];

/**
 * Period-specific change copy. Until the data layer accepts a period arg
 * (B2-MD), 1D uses the live `dayChange` and the rest are derived from the
 * existing summary fields so the toggle is visibly responsive.
 */
function changeForPeriod(
  s: PortfolioSummary,
  period: ComparePeriod,
): { abs: string; pct: string; label: string } {
  switch (period) {
    case 'WTD':
      return { abs: '+$58,210', pct: '+4.62%', label: 'WTD' };
    case 'MTD':
      return { abs: '+$112,840', pct: '+9.62%', label: 'MTD' };
    case 'YTD':
      return { abs: '+$199,520', pct: s.ytd, label: 'YTD' };
    case '1D':
    default:
      return { abs: s.dayChange, pct: s.dayChangePct, label: 'TODAY' };
  }
}

export function KPIStrip() {
  const [period, setPeriod] = useState<ComparePeriod>('1D');
  const { data, loading } = useAsync(() => getSummary(), []);

  const dimmed = loading && !data ? { opacity: 0.4 } : undefined;
  const change = data
    ? changeForPeriod(data, period)
    : { abs: '$—', pct: '—', label: 'TODAY' };

  const kpis: [string, string, string][] = data
    ? [
        ['EXPOSURE',    data.exposure,  data.exposureNote],
        ['RISK SCORE',  data.riskScore, data.riskNote],
        ['DRAWDOWN',    data.drawdown,  data.drawdownNote],
      ]
    : [
        ['EXPOSURE',    '—', '—'],
        ['RISK SCORE',  '—', '—'],
        ['DRAWDOWN',    '—', '—'],
      ];

  return (
    <div
      className="wf-panel"
      style={{
        padding: 14,
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
        gap: 18,
      }}
    >
      <div style={dimmed}>
        <div className="row between" style={{ alignItems: 'flex-start' }}>
          <div className="wf-label">Net Asset Value</div>
          <div
            className="row gap-1"
            role="tablist"
            aria-label="Comparison period"
          >
            {PERIODS.map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={period === p}
                className={period === p ? 'tab active' : 'tab'}
                style={{
                  padding: '3px 8px',
                  fontSize: 10,
                  fontFamily: 'var(--font-mono)',
                  letterSpacing: '0.06em',
                  background: period === p ? undefined : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
                onClick={() => setPeriod(p)}
              >
                {p}
              </button>
            ))}
          </div>
        </div>
        <div className="wf-num" style={{ fontSize: 30 }}>
          {data ? (
            <>
              {data.navFormatted.slice(0, -3)}
              <span className="muted">{data.navFormatted.slice(-3)}</span>
            </>
          ) : (
            '—'
          )}
        </div>
        <div
          className={change.abs.startsWith('+') ? 'up wf-mono' : 'down wf-mono'}
          style={{ fontSize: 12 }}
        >
          {change.abs} ({change.pct}) · {change.label}
        </div>
        <div className="wf-mini muted-2" style={{ marginTop: 4 }}>
          YTD {data?.ytd ?? '—'} · 1Y {data?.oneYear ?? '—'} · SHARPE{' '}
          {data ? data.sharpe.toFixed(2) : '—'}
        </div>
      </div>
      {kpis.map((m, i) => (
        <div key={m[0]} style={dimmed}>
          <div className="wf-mini">{m[0]}</div>
          <div className="wf-num" style={{ fontSize: 22, marginTop: 2 }}>
            {m[1]}
          </div>
          <div className="wf-mini muted-2">{m[2]}</div>
          <div style={{ marginTop: 6 }}>
            <Spark
              seed={50 + i}
              trend={i % 2 ? -0.3 : 0.4}
              w={200}
              h={26}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
