import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth, type Role } from "../../auth/AuthContext";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

const ROLE_LABEL: Record<Role, string> = {
  USER: "Member login",
  SUPERADMIN: "Admin login",
};

const ROLE_HOME: Record<Role, string> = {
  USER: "/app/home",
  SUPERADMIN: "/admin/offers",
};

export function LoginPage({ role }: { role: Role }) {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const user = await login(identifier, password, role);
      navigate(user.mustChangePassword ? "/change-password" : ROLE_HOME[role]);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  const form = (
    <>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit}>
        {role === "USER" ? (
          <TextInput
            id="identifier"
            label="ID"
            type="text"
            inputMode="numeric"
            pattern="\d{4}"
            maxLength={4}
            autoComplete="username"
            placeholder="4-digit ID"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        ) : (
          <TextInput
            id="identifier"
            label="Email"
            type="email"
            autoComplete="username"
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
          />
        )}
        <TextInput
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Logging in..." : "Log in"}
        </Button>
      </form>
      {/* Delegates have no email on file to send a reset link to — an admin
          resets their password from the Users page instead. */}
      {role === "SUPERADMIN" && (
        <p className="muted" style={{ marginTop: 16 }}>
          <Link to="/forgot-password">Forgot your password?</Link>
        </p>
      )}
    </>
  );

  if (role === "USER") {
    return (
      <div className="user-shell">
        <div className="user-auth-shell">
          <div className="user-auth-mark">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2.5" />
              <path d="M3 10.5h18" />
              <path d="M7 14.5h4" />
            </svg>
          </div>
          <p className="user-auth-eyebrow">Welcome back</p>
          <h1 className="user-wordmark">Cimun Card</h1>
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow centered">
      <span className="dashboard-brand-mark" style={{ marginBottom: 16 }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="6" width="18" height="13" rx="2.5" />
          <path d="M3 10.5h18" />
          <path d="M7 14.5h4" />
        </svg>
      </span>
      <h1>{ROLE_LABEL[role]}</h1>
      <div className="card">{form}</div>
    </div>
  );
}
