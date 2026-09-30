import { Navigate, Outlet } from "react-router-dom";
import { useAuth, type Role } from "./AuthContext";

const LOGIN_PATH: Record<Role, string> = {
  USER: "/login/user",
  SUPERADMIN: "/login/admin",
};

export function ProtectedRoute({ role }: { role: Role }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!user || !user.roles.includes(role)) {
    return <Navigate to={LOGIN_PATH[role]} replace />;
  }

  if (user.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <Outlet />;
}
