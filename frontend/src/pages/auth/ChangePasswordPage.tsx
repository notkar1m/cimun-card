import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError, useAuth, type AuthUser } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";
import { useAppSettings } from "../../lib/useAppSettings";

// A dual-role account (admin + delegate) lands in the admin dashboard,
// matching RootRedirect's default for the same account.
function homeFor(user: AuthUser): string {
  return user.roles.includes("SUPERADMIN") ? "/admin/offers" : "/app/home";
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function ChangePasswordPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { user, refresh } = useAuth();
  const settings = useAppSettings();
  const navigate = useNavigate();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Defensive fallback for any legacy account that predates name being
  // required at signup — every current creation path already requires it.
  const needsName = !user.name;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/change-password", {
        currentPassword,
        newPassword,
        ...(needsName ? { name } : {}),
      });
      await refresh();
      navigate(homeFor(user!));
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
        {needsName && (
          <TextInput
            id="name"
            label="Full name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}
        <TextInput
          id="currentPassword"
          label="Current password"
          type="password"
          autoComplete="current-password"
          required
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <TextInput
          id="newPassword"
          label="New password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
          {submitting ? "Saving..." : "Save new password"}
        </Button>
      </form>
    </>
  );

  if (embedded) {
    return (
      <div className="page-narrow" style={{ padding: "12px 0 0" }}>
        <h1>Account</h1>

        <div className="card account-profile-card">
          <span className="account-avatar">{initials(user.name)}</span>
          <div className="account-profile-info">
            <p className="account-profile-name">{user.name}</p>
            <p className="account-profile-email">{user.email ?? `ID: ${user.loginId}`}</p>
          </div>
        </div>

        {settings.wrappedEnabled && user.roles.includes("USER") && (
          <Link to="/app/wrapped" className="wrapped-entry-card">
            <span className="wrapped-entry-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18V5l12-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="16" r="3" />
              </svg>
            </span>
            <span className="wrapped-entry-body">
              <span className="wrapped-entry-title">Your Cimun Card Wrapped</span>
              <span className="wrapped-entry-note">See your redemption recap</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </Link>
        )}

        <p className="user-section-label">Change password</p>
        {user.mustChangePassword && (
          <p className="muted">You need to set a new password before continuing.</p>
        )}
        <div className="card">{form}</div>
      </div>
    );
  }

  if (!user.roles.includes("SUPERADMIN")) {
    return (
      <div className="user-shell">
        <div className="user-auth-shell">
          <div className="user-auth-mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="6" width="18" height="13" rx="2.5" />
              <path d="M3 10.5h18" />
            </svg>
          </div>
          <p className="user-auth-eyebrow">Cimun Card</p>
          <h1 className="user-auth-heading">Set a new password</h1>
          {user.mustChangePassword && (
            <p className="muted" style={{ marginTop: -16, marginBottom: 20 }}>
              This is your first login &mdash; set a password only you know before continuing.
            </p>
          )}
          {form}
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow centered">
      <h1>Change your password</h1>
      {user.mustChangePassword && (
        <p className="muted">You need to set a new password before continuing.</p>
      )}
      <div className="card">{form}</div>
    </div>
  );
}
