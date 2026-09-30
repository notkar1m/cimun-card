import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";

export function UserForm() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/admin/users", { email, name, phone });
      navigate("/admin/users");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>New user</h1>
      <p className="muted">
        A temporary password will be emailed to this address. The user will be required to change
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
          id="email"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextInput
          id="phone"
          label="Phone number"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create user"}
        </Button>
      </form>
    </div>
  );
}
