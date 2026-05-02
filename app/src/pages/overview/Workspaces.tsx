import { useLocation, useNavigate } from 'react-router-dom';

interface WorkspaceItem {
  /** Display label. */
  label: string;
  /** Route to navigate to on click / Enter / Space. */
  to: string;
  /** Optional badge count rendered to the right (e.g. alerts). */
  badge?: number;
}

/**
 * Six useful shortcuts. Workspaces is duplicate of the topbar nav for the
 * "Today's Brief / My Portfolio / Geo Risk / Detail / Leaderboard / AI"
 * top-of-mind destinations the user reaches for from Overview most often.
 */
const WORKSPACES: WorkspaceItem[] = [
  { label: "Today's Brief",   to: '/overview' },
  { label: 'My Portfolio',    to: '/portfolio' },
  { label: 'Geo Risk',        to: '/geo' },
  { label: 'NVDA Detail',     to: '/detail/NVDA' },
  { label: 'Leaderboard',     to: '/leaderboard' },
  { label: 'AI Assistant',    to: '/ai-assistant' },
];

export function Workspaces() {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  return (
    <div>
      <div className="wf-label">Workspaces</div>
      <ul
        role="list"
        style={{
          listStyle: 'none',
          padding: 0,
          margin: '8px 0 0',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
        }}
      >
        {WORKSPACES.map((w) => {
          // Active = exact path match. Using equality (not startsWith) so
          // that "/overview" doesn't also light up while on "/overview/foo".
          const isActive = pathname === w.to;

          // Native <button> handles Enter/Space activation + tab focus
          // automatically. We render it inside an <li> so the list
          // structure stays intact for screen readers.
          return (
            <li
              key={w.label}
              style={{ marginBottom: 1 }}
            >
              <button
                type="button"
                onClick={() => navigate(w.to)}
                aria-current={isActive ? 'page' : undefined}
                className={'tab' + (isActive ? ' active' : '')}
                style={{
                  all: 'unset',
                  display: 'flex',
                  justifyContent: 'space-between',
                  width: '100%',
                  boxSizing: 'border-box',
                  padding: '6px 8px',
                  borderRadius: 4,
                  background: isActive ? 'var(--panel-2)' : 'transparent',
                  color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                }}
                title={`Go to ${w.to}`}
              >
                <span>{w.label}</span>
                {w.badge !== undefined && (
                  <span className="accent">{w.badge}</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
