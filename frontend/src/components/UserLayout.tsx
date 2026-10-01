import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { useAppSettings } from "../lib/useAppSettings";

function HomeIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3.5 10.5 12 3l8.5 7.5" />
      <path d="M5.5 9.5V20a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

function CardIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10.5h18" />
      <path d="M7 14.5h4" />
    </svg>
  );
}

function MapPinIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

function AccountIcon({ active }: { active: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.1 : 1.75} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="3.5" />
      <path d="M4.5 20c1.4-3.6 4.3-5.5 7.5-5.5s6.1 1.9 7.5 5.5" />
    </svg>
  );
}

const TABS = [
  { to: "/app/home", label: "Offers", Icon: HomeIcon },
  { to: "/app/map", label: "Map", Icon: MapPinIcon },
  { to: "/app/activations", label: "My Redemptions", Icon: CardIcon },
  { to: "/app/account", label: "Account", Icon: AccountIcon },
];

export function UserLayout() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const settings = useAppSettings();

  const visibleTabs = TABS.filter((tab) => tab.to !== "/app/map" || settings.mapTabEnabled);

  // Drill-in screens (offer detail) own the bottom edge with their own CTA;
  // showing the tab bar underneath it too would double up fixed bottom bars.
  const isDrillIn = /^\/app\/offers\//.test(location.pathname);
  // Wrapped is a full-screen, immersive "moment" (like the redeem card) —
  // it owns the entire viewport, no topbar or tabbar chrome around it.
  const isImmersive = location.pathname === "/app/wrapped";

  async function handleLogout() {
    await logout();
    navigate("/");
  }

  return (
    <div className="user-shell">
      {!isImmersive && (
        <header className="user-topbar">
          <span className="user-topbar-title">Cimun Card</span>
          <button
            type="button"
            className="user-topbar-action"
            onClick={handleLogout}
            aria-label="Log out"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
              <path d="M16 17l5-5-5-5" />
              <path d="M21 12H9" />
            </svg>
          </button>
        </header>
      )}

      <main className={isImmersive ? "user-content-immersive" : `user-content${isDrillIn ? " no-tabbar" : ""}`}>
        <Outlet />
        {!isImmersive && (
          <p className="user-powered-by">
            Powered by{" "}
            <a href="https://matbakh.tech" target="_blank" rel="noopener noreferrer">
              Matbakh
            </a>
          </p>
        )}
      </main>

      {!isDrillIn && !isImmersive && (
        <nav className="user-tabbar" aria-label="Primary">
          <div className="user-tabbar-inner">
            {visibleTabs.map(({ to, label, Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `user-tabbar-item${isActive ? " active" : ""}`}
              >
                {({ isActive }) => (
                  <>
                    <Icon active={isActive} />
                    <span>{label}</span>
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
  );
}
