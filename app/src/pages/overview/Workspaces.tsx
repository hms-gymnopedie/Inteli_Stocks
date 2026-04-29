const WORKSPACES = [
  'Overview',
  'Geopolitics',
  'Sectors',
  'Macro Monitor',
  'Watchlist',
  'Portfolio',
  'AI Insights',
  'Alerts',
];

export function Workspaces() {
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
        {WORKSPACES.map((n, i) => (
          <li
            key={n}
            style={{
              padding: '6px 8px',
              borderRadius: 4,
              background: i === 0 ? 'var(--panel-2)' : 'transparent',
              color: i === 0 ? 'var(--fg)' : 'var(--fg-3)',
              marginBottom: 1,
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{n}</span>
            {i === 7 && <span className="accent">3</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
