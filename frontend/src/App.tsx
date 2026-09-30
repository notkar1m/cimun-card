import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { Layout } from "./components/Layout";
import { UserLayout } from "./components/UserLayout";
import { AccountIcon, GearIcon, MailIcon, PeopleIcon, ShieldIcon, TagIcon } from "./components/icons";
import { LoginPage } from "./pages/auth/LoginPage";
import { ForgotPasswordPage } from "./pages/auth/ForgotPasswordPage";
import { ResetPasswordPage } from "./pages/auth/ResetPasswordPage";
import { ChangePasswordPage } from "./pages/auth/ChangePasswordPage";
import { HomeFeed } from "./pages/user/HomeFeed";
import { OfferDetail } from "./pages/user/OfferDetail";
import { MyActivations } from "./pages/user/MyActivations";
import { MapPage } from "./pages/user/MapPage";
import { OffersList } from "./pages/admin/OffersList";
import { OfferForm } from "./pages/admin/OfferForm";
import { UsersList } from "./pages/admin/UsersList";
import { UserForm } from "./pages/admin/UserForm";
import { AdminsList } from "./pages/admin/AdminsList";
import { AdminForm } from "./pages/admin/AdminForm";
import { BroadcastPage } from "./pages/admin/BroadcastPage";
import { SettingsPage } from "./pages/admin/SettingsPage";
import { WrappedPage } from "./pages/user/WrappedPage";

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
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      <Route element={<ProtectedRoute role="USER" />}>
        <Route element={<UserLayout />}>
          <Route path="/app/home" element={<HomeFeed />} />
          <Route path="/app/offers/:id" element={<OfferDetail />} />
          <Route path="/app/map" element={<MapPage />} />
          <Route path="/app/activations" element={<MyActivations />} />
          <Route path="/app/account" element={<ChangePasswordPage embedded />} />
          <Route path="/app/wrapped" element={<WrappedPage />} />
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
                { to: "/admin/broadcast", label: "Broadcast", icon: <MailIcon /> },
                { to: "/admin/settings", label: "Settings", icon: <GearIcon /> },
                { to: "/admin/account", label: "Account", icon: <AccountIcon /> },
              ]}
            />
          }
        >
          <Route path="/admin/offers" element={<OffersList />} />
          <Route path="/admin/offers/new" element={<OfferForm />} />
          <Route path="/admin/offers/:id/edit" element={<OfferForm />} />
          <Route path="/admin/users" element={<UsersList />} />
          <Route path="/admin/users/new" element={<UserForm />} />
          <Route path="/admin/admins" element={<AdminsList />} />
          <Route path="/admin/admins/new" element={<AdminForm />} />
          <Route path="/admin/broadcast" element={<BroadcastPage />} />
          <Route path="/admin/settings" element={<SettingsPage />} />
          <Route path="/admin/account" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
