import { useLocation } from 'react-router-dom';

interface WorkspaceItem {
  label: string;
  /** Route path that should activate this row, if any. */
  match?: string;
  /** Optional badge count rendered to the right (e.g. alerts). */
  badge?: number;
}

const WORKSPACES: WorkspaceItem[] = [
  { label: 'Overview', match: '/overview' },
  { label: 'Geopolitics', match: '/geo' },
  { label: 'Sectors' },
  { label: 'Macro Monitor' },
  { label: 'Watchlist' },
  { label: 'Portfolio', match: '/portfolio' },
  { label: 'AI Insights' },
  { label: 'Alerts', badge: 3 },
];

export function Workspaces() {
  const { pathname } = useLocation();

  return (
    <div>
      <div className="wf-label">Workspaces</div>
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '8px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {WORKSPACES.map((w) => {
          const isActive = w.match ? pathname.startsWith(w.match) : false;
          return (
            <li
              key={w.label}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                background: isActive ? 'var(--panel-2)' : 'transparent',
                color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                marginBottom: 1,
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{w.label}</span>
              {w.badge !== undefined && (
                <span className="accent">{w.badge}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
