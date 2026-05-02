import { useLocation, useNavigate } from 'react-router-dom';
import type { KeyboardEvent } from 'react';

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

          const onActivate = () => navigate(w.to);
          const onKey = (e: KeyboardEvent<HTMLLIElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onActivate();
            }
          };

          return (
            <li
              key={w.label}
              role="link"
              tabIndex={0}
              aria-current={isActive ? 'page' : undefined}
              onClick={onActivate}
              onKeyDown={onKey}
              className={'tab' + (isActive ? ' active' : '')}
              style={{
                padding: '6px 8px',
                borderRadius: 4,
                background: isActive ? 'var(--panel-2)' : 'transparent',
                color: isActive ? 'var(--fg)' : 'var(--fg-3)',
                marginBottom: 1,
                display: 'flex',
                justifyContent: 'space-between',
                cursor: 'pointer',
              }}
              title={`Go to ${w.to}`}
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
