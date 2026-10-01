import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError, useAuth } from "../../auth/AuthContext";
import { Alert, Button, Spinner } from "../../components/ui";

interface Admin {
  id: string;
  email: string | null;
  loginId: string | null;
  name: string;
  roles: ("SUPERADMIN" | "USER")[];
  isOwner: boolean;
  mustChangePassword: boolean;
  createdAt: string;
}

export function AdminsList() {
  const { user } = useAuth();
  const location = useLocation();
  const notice = (location.state as { notice?: string } | null)?.notice ?? null;
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "admins"],
    queryFn: () => api.get<{ admins: Admin[] }>("/admin/admins"),
  });
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function handleDelete(admin: Admin) {
    const label = admin.email ?? admin.loginId;
    if (!confirm(`Remove admin access for ${admin.name} (${label})? They'll stay a regular user.`)) return;
    setError(null);
    setDeletingId(admin.id);
    try {
      await api.delete(`/admin/admins/${admin.id}`);
      queryClient.invalidateQueries({ queryKey: ["admin", "admins"] });
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div className="space-between">
        <h1>Admins</h1>
        {user?.isOwner && (
          <Link to="/admin/admins/new">
            <Button>New admin</Button>
          </Link>
        )}
      </div>

      {!user?.isOwner && (
        <p className="muted" style={{ marginTop: -8 }}>
          You can see the full admin team here. Only the account owner can add or remove admins.
        </p>
      )}

      {notice && <Alert type="success">{notice}</Alert>}
      {error && <Alert type="error">{error}</Alert>}
      {isLoading ? (
        <Spinner />
      ) : (
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>ID / Email</th>
              <th>Access</th>
              <th>Status</th>
              <th>Created</th>
              {user?.isOwner && <th />}
            </tr>
          </thead>
          <tbody>
            {(data?.admins ?? []).map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>
                  {a.name}
                  {a.id === user?.id && <span className="muted"> (you)</span>}
                </td>
                <td>{a.loginId ?? a.email}</td>
                <td>
                  {a.isOwner ? (
                    <span className="badge badge-success">Owner</span>
                  ) : a.roles.includes("USER") ? (
                    <span className="badge">Admin + User</span>
                  ) : (
                    <span className="badge">Admin</span>
                  )}
                </td>
                <td>
                  <span className={`badge ${a.mustChangePassword ? "badge-warning" : "badge-success"}`}>
                    {a.mustChangePassword ? "Awaiting first login" : "Active"}
                  </span>
                </td>
                <td>{new Date(a.createdAt).toLocaleDateString()}</td>
                {user?.isOwner && (
                  <td>
                    {!a.isOwner && (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => handleDelete(a)}
                        disabled={deletingId === a.id}
                      >
                        {deletingId === a.id ? "Removing..." : "Remove"}
                      </Button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
