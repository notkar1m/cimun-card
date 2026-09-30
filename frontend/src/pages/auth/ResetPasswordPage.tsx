import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const navigate = useNavigate();
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/auth/reset-password", { token, newPassword });
      navigate("/login/user", { state: { resetSuccess: true } });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="page-narrow centered">
        <Alert type="error">This reset link is missing a token.</Alert>
        <Link to="/forgot-password">Request a new one</Link>
      </div>
    );
  }

  return (
    <div className="page-narrow centered">
      <h1>Set a new password</h1>
      <div className="card">
        {error && <Alert type="error">{error}</Alert>}
        <form onSubmit={handleSubmit}>
          <TextInput
            id="newPassword"
            label="New password"
            type="password"
            minLength={8}
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" disabled={submitting} style={{ width: "100%" }}>
            {submitting ? "Saving..." : "Set new password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
