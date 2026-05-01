import { useEffect, useRef, useState } from 'react';
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { FetchIndicator, LiveClock, RefreshButton } from './lib/FetchIndicator';
import { SymbolSearch } from './lib/SymbolSearch';
import { TweaksPanel, TweaksProvider } from './lib/tweaks';
import { AuthProvider, useAuth } from './lib/auth';
import { Overview } from './pages/overview';
import { Portfolio } from './pages/portfolio';
import { GeoRisk } from './pages/geo';
import { Detail } from './pages/detail';
import { Settings } from './pages/settings';
import { Login } from './pages/auth/Login';

const NAV = [
  { to: '/overview',  label: 'Overview'  },
  { to: '/portfolio', label: 'Portfolio' },
  { to: '/geo',       label: 'Geo Risk'  },
  { to: '/detail',    label: 'Security'  },
  { to: '/settings',  label: 'Settings'  },
];

// ─── Auth chip (shown in topbar when signed in via Supabase) ──────────────────

function AuthChip() {
  const { user, mode, signOut } = useAuth();
  const navigate = useNavigate();

  if (mode !== 'supabase' || !user) return null;

  const label = user.email ?? user.id.slice(0, 8);

  return (
    <div className="auth-chip" title={`Signed in as ${user.email ?? user.id}`}>
      <span className="auth-chip-email">{label}</span>
      <button
        type="button"
        className="auth-chip-signout"
        aria-label="Sign out"
        title="Sign out"
        onClick={() => {
          void signOut().then(() => { void navigate('/login', { replace: true }); });
        }}
      >
        ↪
      </button>
    </div>
  );
}

// ─── Route guard — redirects to /login when Supabase is configured but user is not authenticated ──

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, mode, loading } = useAuth();
  const location = useLocation();

  // Still fetching config — render nothing to avoid flash
  if (loading) return null;

  // Local mode or already authenticated — pass through
  if (mode !== 'supabase' || user) return <>{children}</>;

  // Supabase mode, not authenticated — redirect to /login
  return <Navigate to="/login" state={{ from: location }} replace />;
}

// ─── TopBar ───────────────────────────────────────────────────────────────────

function TopBar() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

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
        {/* Auth chip appears between Refresh and LiveClock in Supabase mode */}
        <AuthChip />
        <LiveClock />
      </div>
    </header>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export function App() {
  return (
    <TweaksProvider>
      <AuthProvider>
        <div className="shell">
          {/* Skip-link — first focusable element on the page. */}
          <a href="#main" className="skip-link">
            Skip to main content
          </a>
          <TopBar />
          <main id="main" className="view" tabIndex={-1}>
            <Routes>
              {/* Public auth routes (always accessible) */}
              <Route path="/login"  element={<Login />} />
              <Route path="/signup" element={<Login />} />

              {/* Protected app routes — RequireAuth redirects to /login in Supabase mode */}
              <Route path="/" element={<RequireAuth><Navigate to="/overview" replace /></RequireAuth>} />
              <Route path="/overview"        element={<RequireAuth><Overview /></RequireAuth>} />
              <Route path="/portfolio"       element={<RequireAuth><Portfolio /></RequireAuth>} />
              <Route path="/geo"             element={<RequireAuth><GeoRisk /></RequireAuth>} />
              <Route path="/detail"          element={<RequireAuth><Detail /></RequireAuth>} />
              <Route path="/detail/:symbol"  element={<RequireAuth><Detail /></RequireAuth>} />
              <Route path="/settings"        element={<RequireAuth><Settings /></RequireAuth>} />
              <Route path="*"                element={<RequireAuth><Navigate to="/overview" replace /></RequireAuth>} />
            </Routes>
          </main>
        </div>
        <TweaksPanel />
        {/* Global ⌘K symbol search */}
        <SymbolSearch />
      </AuthProvider>
    </TweaksProvider>
  );
}
