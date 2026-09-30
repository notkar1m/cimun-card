import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError, useAuth } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

interface CreateAdminResult {
  upgradedExisting: boolean;
}

export function AdminForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [alsoDelegate, setAlsoDelegate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await api.post<CreateAdminResult>("/admin/admins", { email, name, alsoDelegate });
      navigate("/admin/admins", {
        state: result.upgradedExisting
          ? { notice: `${email} already had a delegate account — admin access was added to it.` }
          : undefined,
      });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!user?.isOwner) {
    return (
      <div className="page-narrow" style={{ padding: "8px 16px" }}>
        <h1>New admin</h1>
        <Alert type="error">Only the account owner can add admins.</Alert>
      </div>
    );
  }

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>New admin</h1>
      <p className="muted">
        They'll get the same access you have to offers, vendors, and delegates &mdash; except they
        can't add, remove, or edit other admins. A temporary password will be emailed to them, and
        they'll be required to change it on first login.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="card">
        <TextInput
          id="name"
          label="Full name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <TextInput
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={alsoDelegate}
              onChange={(e) => setAlsoDelegate(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Also a delegate (can browse and redeem offers like any other user)
          </label>
        </div>
        <p className="muted" style={{ marginTop: -6 }}>
          If this email already belongs to a delegate, admin access is added to that account instead
          of creating a new one &mdash; this checkbox won't matter in that case.
        </p>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create admin"}
        </Button>
      </form>
    </div>
  );
}
