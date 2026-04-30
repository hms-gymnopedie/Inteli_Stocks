import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { FetchIndicator, LiveClock, RefreshButton } from './lib/FetchIndicator';
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
  // Mobile hamburger state — collapses the inline nav links into a dropdown
  // below the bar at narrow widths. CSS (`.nav-toggle`, `.nav.is-open`) drives
  // the actual show/hide via media queries; this local state just toggles the
  // class so we don't rely on JS-side viewport detection.
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  // Close the dropdown on route change so tapping a nav link doesn't leave the
  // overlay sticky.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // Close on Escape and on outside click for keyboard / pointer parity.
  useEffect(() => {
    if (!navOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setNavOpen(false);
    };
    const handleClick = (e: MouseEvent) => {
      if (!navRef.current) return;
      if (!navRef.current.contains(e.target as Node)) setNavOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('mousedown', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [navOpen]);

  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand-dot" />
        <span>InteliStock</span>
      </div>

      <button
        type="button"
        className="nav-toggle"
        aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={navOpen}
        aria-controls="primary-nav"
        onClick={() => setNavOpen((v) => !v)}
      >
        {navOpen ? '✕' : '≡'}
      </button>

      <nav
        id="primary-nav"
        className={navOpen ? 'nav is-open' : 'nav'}
        ref={navRef}
        aria-label="Primary"
      >
        {NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => (isActive ? 'active' : '')}
            onClick={() => setNavOpen(false)}
          >
            {n.label}
          </NavLink>
        ))}
      </nav>
      <div className="topbar-right">
        <FetchIndicator />
        <RefreshButton />
        <LiveClock />
      </div>
    </header>
  );
}

export function App() {
  return (
    <TweaksProvider>
      <div className="shell">
        {/* Skip-link — first focusable element on the page. Hidden off-screen
            by .skip-link CSS until it receives keyboard focus, then jumps to
            <main id="main"> below. WCAG 2.4.1 bypass-blocks. */}
        <a href="#main" className="skip-link">
          Skip to main content
        </a>
        <TopBar />
        <main id="main" className="view" tabIndex={-1}>
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
