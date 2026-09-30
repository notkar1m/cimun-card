import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setDone(true);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow centered">
      <h1>Reset your password</h1>
      <div className="card">
        {error && <Alert type="error">{error}</Alert>}
        {done ? (
          <Alert type="success">
            If an account exists for that email, we've sent a link to reset the password.
          </Alert>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextInput
              id="email"
              label="Email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
              {submitting ? "Sending..." : "Send reset link"}
            </Button>
          </form>
        )}
      </div>
      <p className="muted" style={{ marginTop: 16 }}>
        <Link to="/login/user">Back to login</Link>
      </p>
    </div>
  );
}
