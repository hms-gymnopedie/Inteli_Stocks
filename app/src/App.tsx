import { NavLink, Navigate, Route, Routes } from 'react-router-dom';
import { FetchIndicator, LiveClock } from './lib/FetchIndicator';
import { SymbolSearch } from './lib/SymbolSearch';
import { TweaksPanel, TweaksProvider } from './lib/tweaks';
import { Overview } from './pages/overview';
import { Portfolio } from './pages/portfolio';
import { GeoRisk } from './pages/geo';
import { Detail } from './pages/detail';
import { Settings } from './pages/settings';

const NAV = [
  { to: '/overview',  label: 'Overview'  },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/geo',       label: 'Geo Risk'  },
  { to: '/detail',    label: 'Security'  },
  { to: '/settings',  label: 'Settings'  },
];

function TopBar() {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <span>InteliStock</span>
      </div>
      <nav className="nav">
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-right">
        <FetchIndicator />
        <LiveClock />
      </div>
    </header>
  );
}

export function App() {
  return (
    <TweaksProvider>
      <div className="shell">
        <TopBar />
        <main className="view">
          <Routes>
            <Route path="/" element={<Navigate to="/overview" replace />} />
            <Route path="/overview" element={<Overview />} />
            <Route path="/portfolio" element={<Portfolio />} />
            <Route path="/geo" element={<GeoRisk />} />
            {/*
             * `/detail` and `/detail/:symbol` both land on Detail. The page
             * reads useParams() and falls back to a default when the param
             * is absent, so the bare `/detail` URL still works.
             */}
            <Route path="/detail" element={<Detail />} />
            <Route path="/detail/:symbol" element={<Detail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/overview" replace />} />
          </Routes>
        </main>
      </div>
      <TweaksPanel />
      {/* Global ⌘K symbol search — listens for the shortcut internally. */}
      <SymbolSearch />
    </TweaksProvider>
  );
}
