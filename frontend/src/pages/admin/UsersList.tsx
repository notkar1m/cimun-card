import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, Spinner } from "../../components/ui";
import { CsvImportModal, type CsvColumn } from "../../components/CsvImportModal";
import { UserRedemptionsModal } from "./UserRedemptionsModal";

const USER_CSV_COLUMNS: CsvColumn[] = [
  { name: "name", note: "required" },
  { name: "id", note: "required — 4 digits, e.g. 4821" },
];

interface User {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string;
  phone: string | null;
  roles: ("SUPERADMIN" | "USER")[];
  mustChangePassword: boolean;
  createdAt: string;
  totalRedemptions: number;
}

interface BulkImportUsersResult {
  created: number;
  resolved: { row: number; name: string; loginId: string; tempPassword: string }[];
  errors: { row: number; message: string }[];
}

export function UsersList() {
  const queryClient = useQueryClient();
  const { data, isLoading, error: loadError } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<{ users: User[] }>("/admin/users"),
    // Redemption counts move while an event is running; don't show a 30s-old number.
    staleTime: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; tempPassword: string } | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [viewingRedemptions, setViewingRedemptions] = useState<User | null>(null);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
  }

  async function handleDelete(user: User) {
    if (!confirm(`Delete the account for ${user.name || user.loginId}? This can't be undone.`)) return;
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
    const label = user.name || user.loginId;
    if (!confirm(`Reset the password for ${label}? They'll need to set a new one on next login.`)) return;
    setError(null);
    setResetResult(null);
    setResettingId(user.id);
    try {
      const res = await api.post<{ tempPassword: string }>(`/admin/users/${user.id}/reset-password`);
      setResetResult({ name: label ?? "", tempPassword: res.tempPassword });
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
        <div className="row">
          <Button variant="secondary" onClick={() => setShowCsvModal(true)}>
            Upload CSV
          </Button>
          <Link to="/admin/users/new">
            <Button>New user</Button>
          </Link>
        </div>
      </div>

      {showCsvModal && (
        <CsvImportModal<BulkImportUsersResult>
          title="Upload users from CSV"
          endpoint="/admin/users/bulk-import"
          columns={USER_CSV_COLUMNS}
          resultNoun="user"
          onClose={() => setShowCsvModal(false)}
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

      {viewingRedemptions && (
        <UserRedemptionsModal
          userId={viewingRedemptions.id}
          userLabel={viewingRedemptions.name || viewingRedemptions.loginId || "User"}
          onClose={() => setViewingRedemptions(null)}
        />
      )}

      {error && <Alert type="error">{error}</Alert>}
      {loadError && (
        <Alert type="error">
          {isApiError(loadError) ? loadError.message : "Couldn't load users"}
        </Alert>
      )}

      {resetResult && (
        <Alert type="success">
          {resetResult.name}: their new temporary password is <code>{resetResult.tempPassword}</code> —
          write it down now.
        </Alert>
      )}

      {isLoading ? (
        <Spinner />
      ) : loadError ? null : (data?.users ?? []).length === 0 ? (
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
              <th>ID</th>
              <th>Access</th>
              <th>Status</th>
              <th>Redemptions</th>
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
                <td>{u.loginId ?? <span className="muted">&mdash;</span>}</td>
                <td>
                  {u.roles.includes("SUPERADMIN") ? (
                    <span className="badge">Admin + User</span>
                  ) : (
                    <span className="muted">User</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${u.mustChangePassword ? "badge-warning" : "badge-success"}`}>
                    {u.mustChangePassword ? "Awaiting first login" : "Active"}
                  </span>
                </td>
                <td>
                  {u.totalRedemptions > 0 ? (
                    <button
                      type="button"
                      className="link-btn"
                      style={{ fontSize: 14, margin: 0 }}
                      onClick={() => setViewingRedemptions(u)}
                      aria-label={`View ${u.totalRedemptions} redemptions for ${u.name || u.loginId}`}
                    >
                      {u.totalRedemptions}
                    </button>
                  ) : (
                    <span className="muted">0</span>
                  )}
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
