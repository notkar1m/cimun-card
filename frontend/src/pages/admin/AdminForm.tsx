import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../../api/client";
import { isApiError, useAuth } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

export function AdminForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loginId, setLoginId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/admin/admins", { loginId });
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
      // A promoted user also appears on the Users page (now with admin access).
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
      navigate("/admin/admins", {
        state: { notice: `Admin access was granted to user ${loginId}.` },
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
        Enter the 4-digit ID of an existing user to give them admin access, in addition to their
        regular user access — they'll keep logging in the same way, with their ID and current
        password.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="card">
        <TextInput
          id="loginId"
          label="User ID"
          placeholder="4-digit ID"
          required
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Granting access..." : "Grant admin access"}
        </Button>
      </form>
    </div>
  );
}
