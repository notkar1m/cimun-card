import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, Modal, Spinner, TextInput } from "../../components/ui";
import { CsvImportModal, type CsvColumn } from "../../components/CsvImportModal";

const DELEGATE_CSV_COLUMNS: CsvColumn[] = [
  { name: "name", note: "required" },
  { name: "id", note: "required — 4 digits, e.g. 4821" },
];

const TEAM_CSV_COLUMNS: CsvColumn[] = [{ name: "email", note: "required" }];

interface User {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string;
  phone: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

interface BulkImportUsersResult {
  created: number;
  resolved: { row: number; name: string; loginId: string; tempPassword: string }[];
  errors: { row: number; message: string }[];
}

interface BulkImportTeamResult {
  created: number;
  errors: { row: number; message: string }[];
}

function NewTeamMemberModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await api.post("/admin/users/team", { email });
      onCreated();
      onClose();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="New team member" onClose={onClose}>
      <p className="muted" style={{ marginTop: -4 }}>
        A temporary password will be emailed to them. They'll be required to set a new one (and
        their name) on first login.
      </p>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit}>
        <TextInput
          id="teamEmail"
          label="Email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create"}
        </Button>
      </form>
    </Modal>
  );
}

export function UsersList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<{ users: User[] }>("/admin/users"),
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; message: string } | null>(null);
  const [showDelegateCsvModal, setShowDelegateCsvModal] = useState(false);
  const [showTeamCsvModal, setShowTeamCsvModal] = useState(false);
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete the account for ${user.name || user.email || user.loginId}? This can't be undone.`)) return;
    setError(null);
    setDeletingId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      invalidate();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleResetPassword(user: User) {
    const label = user.name || user.email || user.loginId;
    if (!confirm(`Reset the password for ${label}? They'll need to set a new one on next login.`)) return;
    setError(null);
    setResetResult(null);
    setResettingId(user.id);
    try {
      const res = await api.post<{ tempPassword?: string; emailed: boolean }>(
        `/admin/users/${user.id}/reset-password`
      );
      setResetResult({
        name: label ?? "",
        message: res.emailed
          ? "A new temporary password was emailed to them."
          : `Their new temporary password is ${res.tempPassword} — there's no email to send it to, write it down now.`,
      });
      invalidate();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setResettingId(null);
    }
  }

  return (
    <div>
      <div className="space-between">
        <h1>Users</h1>
      </div>

      <div className="user-management-actions">
        <div>
          <p className="muted user-management-label">Delegates (ID login)</p>
          <div className="row">
            <Button variant="secondary" onClick={() => setShowDelegateCsvModal(true)}>
              Upload CSV
            </Button>
            <Link to="/admin/users/new">
              <Button>New user</Button>
            </Link>
          </div>
        </div>
        <div>
          <p className="muted user-management-label">Team members (email login)</p>
          <div className="row">
            <Button variant="secondary" onClick={() => setShowTeamCsvModal(true)}>
              Upload CSV
            </Button>
            <Button onClick={() => setShowNewTeamModal(true)}>New team member</Button>
          </div>
        </div>
      </div>

      {showDelegateCsvModal && (
        <CsvImportModal<BulkImportUsersResult>
          title="Upload delegates from CSV"
          endpoint="/admin/users/bulk-import"
          columns={DELEGATE_CSV_COLUMNS}
          resultNoun="user"
          onClose={() => setShowDelegateCsvModal(false)}
          onImported={invalidate}
          renderExtra={(result) =>
            result.resolved.length > 0 ? (
              <div style={{ marginTop: 12 }}>
                <p className="muted" style={{ marginBottom: 6 }}>
                  There's no email to send these to — write them down now.
                </p>
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>ID</th>
                      <th>Temp password</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.resolved.map((r) => (
                      <tr key={r.loginId}>
                        <td>{r.name}</td>
                        <td>
                          <code>{r.loginId}</code>
                        </td>
                        <td>
                          <code>{r.tempPassword}</code>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null
          }
        />
      )}

      {showTeamCsvModal && (
        <CsvImportModal<BulkImportTeamResult>
          title="Upload team members from CSV"
          endpoint="/admin/users/team/bulk-import"
          columns={TEAM_CSV_COLUMNS}
          resultNoun="team member"
          onClose={() => setShowTeamCsvModal(false)}
          onImported={invalidate}
        />
      )}

      {showNewTeamModal && (
        <NewTeamMemberModal onClose={() => setShowNewTeamModal(false)} onCreated={invalidate} />
      )}

      {error && <Alert type="error">{error}</Alert>}

      {resetResult && (
        <Alert type="success">
          {resetResult.name}: {resetResult.message}
        </Alert>
      )}

      {isLoading ? (
        <Spinner />
      ) : (data?.users ?? []).length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No users yet. Create one to get started.
          </p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>ID / Email</th>
              <th>Status</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((u) => (
              <tr key={u.id}>
                <td style={{ fontWeight: 600 }}>
                  {u.name || <span className="muted">Not set yet</span>}
                </td>
                <td>{u.loginId ?? u.email ?? <span className="muted">&mdash;</span>}</td>
                <td>
                  <span className={`badge ${u.mustChangePassword ? "badge-warning" : "badge-success"}`}>
                    {u.mustChangePassword ? "Awaiting first login" : "Active"}
                  </span>
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <div className="row">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleResetPassword(u)}
                      disabled={resettingId === u.id}
                    >
                      {resettingId === u.id ? "Resetting..." : "Reset password"}
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => handleDelete(u)}
                      disabled={deletingId === u.id}
                    >
                      {deletingId === u.id ? "Deleting..." : "Delete"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
