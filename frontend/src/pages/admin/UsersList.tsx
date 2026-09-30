import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, Spinner } from "../../components/ui";
import { CsvImportModal, type CsvColumn } from "../../components/CsvImportModal";

const USER_CSV_COLUMNS: CsvColumn[] = [
  { name: "email", note: "required" },
  { name: "name", note: "optional — leave blank or use 0; they'll set it on first login" },
  { name: "phone", note: "optional — leave blank or use 0; they'll set it on first login" },
];

interface User {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  mustChangePassword: boolean;
  createdAt: string;
}

export function UsersList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "users"],
    queryFn: () => api.get<{ users: User[] }>("/admin/users"),
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCsvModal, setShowCsvModal] = useState(false);

  async function handleDelete(user: User) {
    if (!confirm(`Delete the account for ${user.name} (${user.email})? This can't be undone.`)) return;
    setError(null);
    setDeletingId(user.id);
    try {
      await api.delete(`/admin/users/${user.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "users"] });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
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
        <CsvImportModal
          title="Upload users from CSV"
          endpoint="/admin/users/bulk-import"
          columns={USER_CSV_COLUMNS}
          resultNoun="user"
          onClose={() => setShowCsvModal(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
        />
      )}

      {error && <Alert type="error">{error}</Alert>}
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
              <th>Email</th>
              <th>Phone</th>
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
                <td>{u.email}</td>
                <td>{u.phone || <span className="muted">&mdash;</span>}</td>
                <td>
                  <span className={`badge ${u.mustChangePassword ? "badge-warning" : "badge-success"}`}>
                    {u.mustChangePassword ? "Awaiting first login" : "Active"}
                  </span>
                </td>
                <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                <td>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => handleDelete(u)}
                    disabled={deletingId === u.id}
                  >
                    {deletingId === u.id ? "Deleting..." : "Delete"}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
