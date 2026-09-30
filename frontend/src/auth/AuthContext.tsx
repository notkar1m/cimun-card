import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api, ApiClientError } from "../api/client";

export type Role = "SUPERADMIN" | "USER";

export interface AuthUser {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string;
  phone: string | null;
  roles: Role[];
  isOwner: boolean;
  mustChangePassword: boolean;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  // Admins send their email here; delegates send their 4-digit ID.
  login: (identifier: string, password: string, expectedRole: Role) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { user } = await api.get<{ user: AuthUser }>("/auth/me");
      setUser(user);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
  }, [refresh]);

  const login = useCallback(async (identifier: string, password: string, expectedRole: Role) => {
    const { user } = await api.post<{ user: AuthUser }>("/auth/login", {
      identifier,
      password,
      expectedRole,
    });
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(async () => {
    await api.post("/auth/logout");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return ctx;
}

export function isApiError(err: unknown): err is ApiClientError {
  return err instanceof ApiClientError;
}
