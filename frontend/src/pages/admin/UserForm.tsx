import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

interface CreatedUser {
  loginId: string;
  name: string;
  tempPassword: string;
}

export function UserForm() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedUser | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const { user } = await api.post<{ user: CreatedUser }>("/admin/users", { name, loginId });
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      setCreated(user);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (created) {
    return (
      <div className="page-narrow" style={{ padding: "8px 16px" }}>
        <h1>New user</h1>
        <Alert type="success">Account created. There's no email to send this to — write it down now.</Alert>
        <div className="card">
          <p style={{ margin: "0 0 4px" }}>
            <strong>{created.name}</strong>
          </p>
          <p className="muted" style={{ margin: "0 0 14px" }}>
            Give the delegate these to log in with — they'll be asked to set their own password
            right after.
          </p>
          <div className="field">
            <label>Login ID</label>
            <code style={{ fontSize: 18 }}>{created.loginId}</code>
          </div>
          <div className="field">
            <label>Temporary password</label>
            <code style={{ fontSize: 18 }}>{created.tempPassword}</code>
          </div>
          <div className="row" style={{ marginTop: 18 }}>
            <Button type="button" variant="secondary" onClick={() => setCreated(null)}>
              Create another
            </Button>
            <Link to="/admin/users">
              <Button type="button">Done</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>New user</h1>
      <p className="muted">
        The temporary password is the delegate's name and ID squashed together, lowercase, no
        spaces (e.g. "Sara Ahmed" + "4821" &rarr; "saraahmed4821"). They'll be required to change
        it on first login.
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
          id="loginId"
          label="4-digit ID"
          inputMode="numeric"
          pattern="\d{4}"
          maxLength={4}
          placeholder="e.g. 4821"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create user"}
        </Button>
      </form>
    </div>
  );
}
