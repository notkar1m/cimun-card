import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Modal, Spinner } from "../../components/ui";

interface UserRedemptions {
  user: { id: string; name: string; loginId: string | null };
  total: number;
  byOffer: { offerId: string; title: string; vendorName: string; count: number }[];
  history: { id: string; offerId: string; offerTitle: string; vendorName: string; redeemedAt: string }[];
}

export function UserRedemptionsModal({
  userId,
  userLabel,
  onClose,
}: {
  userId: string;
  userLabel: string;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin", "users", userId, "redemptions"],
    queryFn: () => api.get<UserRedemptions>(`/admin/users/${userId}/redemptions`),
    // This is a live look at what someone has redeemed, so never serve it from cache.
    staleTime: 0,
  });

  return (
    <Modal title={`Redemptions: ${userLabel}`} onClose={onClose} wide>
      {isLoading && <Spinner />}
      {error && <Alert type="error">{isApiError(error) ? error.message : "Couldn't load redemptions"}</Alert>}

      {data && data.total === 0 && <p className="muted">No redemptions yet.</p>}

      {data && data.total > 0 && (
        <>
          <p style={{ margin: 0 }}>
            <strong>{data.total}</strong> redemption{data.total === 1 ? "" : "s"} in total
          </p>

          <p className="modal-section-title">By offer</p>
          <table>
            <thead>
              <tr>
                <th>Offer</th>
                <th>Redemptions</th>
              </tr>
            </thead>
            <tbody>
              {data.byOffer.map((o) => (
                <tr key={o.offerId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{o.title}</div>
                    <div className="muted">{o.vendorName}</div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{o.count}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="modal-section-title">History</p>
          <table>
            <thead>
              <tr>
                <th>When</th>
                <th>Offer</th>
              </tr>
            </thead>
            <tbody>
              {data.history.map((h) => (
                <tr key={h.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{new Date(h.redeemedAt).toLocaleString()}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{h.offerTitle}</div>
                    <div className="muted">{h.vendorName}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Modal>
  );
}
