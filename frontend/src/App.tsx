import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { UserLayout } from "./components/UserLayout";
import { AccountIcon, GearIcon, PeopleIcon, ShieldIcon, TagIcon } from "./components/icons";
import { LoginPage } from "./pages/auth/LoginPage";
import { ChangePasswordPage } from "./pages/auth/ChangePasswordPage";
import { HomeFeed } from "./pages/user/HomeFeed";
import { OfferDetail } from "./pages/user/OfferDetail";
import { MyActivations } from "./pages/user/MyActivations";

// Every delegate device loads the core feed/detail/activations pages on
// login — those stay in the main bundle. The map (pulls in Leaflet) and
// Wrapped (a once-a-year feature) are only visited by a fraction of
// delegates per session, and the entire admin dashboard is never touched by
// the vast majority of the ~2500 devices this app serves at once. Splitting
// them out means a delegate's phone only downloads the admin bundle if an
// account with admin access actually navigates there.
const MapPage = lazy(() => import("./pages/user/MapPage").then((m) => ({ default: m.MapPage })));
const WrappedPage = lazy(() => import("./pages/user/WrappedPage").then((m) => ({ default: m.WrappedPage })));
const OffersList = lazy(() => import("./pages/admin/OffersList").then((m) => ({ default: m.OffersList })));
const OfferForm = lazy(() => import("./pages/admin/OfferForm").then((m) => ({ default: m.OfferForm })));
const UsersList = lazy(() => import("./pages/admin/UsersList").then((m) => ({ default: m.UsersList })));
const UserForm = lazy(() => import("./pages/admin/UserForm").then((m) => ({ default: m.UserForm })));
const AdminsList = lazy(() => import("./pages/admin/AdminsList").then((m) => ({ default: m.AdminsList })));
const AdminForm = lazy(() => import("./pages/admin/AdminForm").then((m) => ({ default: m.AdminForm })));
const SettingsPage = lazy(() => import("./pages/admin/SettingsPage").then((m) => ({ default: m.SettingsPage })));

function PageFallback() {
  return <div className="page-loading">Loading...</div>;
}

function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading...</div>;
  if (user) {
    // A dual-role account (admin + delegate) lands in the admin dashboard
    // by default; they can still get to the delegate app at /app/home.
    return <Navigate to={user.roles.includes("SUPERADMIN") ? "/admin/offers" : "/app/home"} replace />;
  }
  return <Navigate to="/login/user" replace />;
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<RootRedirect />} />
      <Route path="/login/user" element={<LoginPage role="USER" />} />
      <Route path="/login/admin" element={<LoginPage role="SUPERADMIN" />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route element={<ProtectedRoute role="USER" />}>
        <Route element={<UserLayout />}>
          <Route path="/app/home" element={<HomeFeed />} />
          <Route path="/app/offers/:id" element={<OfferDetail />} />
          <Route
            path="/app/map"
            element={
              <Suspense fallback={<PageFallback />}>
                <MapPage />
              </Suspense>
            }
          />
          <Route path="/app/activations" element={<MyActivations />} />
          <Route path="/app/account" element={<ChangePasswordPage embedded />} />
          <Route
            path="/app/wrapped"
            element={
              <Suspense fallback={<PageFallback />}>
                <WrappedPage />
              </Suspense>
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute role="SUPERADMIN" />}>
        <Route
          element={
            <Layout
              title="Admin"
              links={[
                { to: "/admin/offers", label: "Offers", icon: <TagIcon /> },
                { to: "/admin/users", label: "Users", icon: <PeopleIcon /> },
                { to: "/admin/admins", label: "Admins", icon: <ShieldIcon /> },
                { to: "/admin/settings", label: "Settings", icon: <GearIcon /> },
                { to: "/admin/account", label: "Account", icon: <AccountIcon /> },
              ]}
            />
          }
        >
          <Route
            path="/admin/offers"
            element={
              <Suspense fallback={<PageFallback />}>
                <OffersList />
              </Suspense>
            }
          />
          <Route
            path="/admin/offers/new"
            element={
              <Suspense fallback={<PageFallback />}>
                <OfferForm />
              </Suspense>
            }
          />
          <Route
            path="/admin/offers/:id/edit"
            element={
              <Suspense fallback={<PageFallback />}>
                <OfferForm />
              </Suspense>
            }
          />
          <Route
            path="/admin/users"
            element={
              <Suspense fallback={<PageFallback />}>
                <UsersList />
              </Suspense>
            }
          />
          <Route
            path="/admin/users/new"
            element={
              <Suspense fallback={<PageFallback />}>
                <UserForm />
              </Suspense>
            }
          />
          <Route
            path="/admin/admins"
            element={
              <Suspense fallback={<PageFallback />}>
                <AdminsList />
              </Suspense>
            }
          />
          <Route
            path="/admin/admins/new"
            element={
              <Suspense fallback={<PageFallback />}>
                <AdminForm />
              </Suspense>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <Suspense fallback={<PageFallback />}>
                <SettingsPage />
              </Suspense>
            }
          />
          <Route path="/admin/account" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
