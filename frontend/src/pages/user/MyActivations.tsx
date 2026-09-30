import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";

interface Activation {
  id: string;
  status: "ACTIVE" | "REDEEMED";
  offerTitle: string;
  vendorName: string;
  activatedAt: string;
  redeemedAt: string | null;
}

export function MyActivations() {
  const { data, isLoading } = useQuery({
    queryKey: ["me", "activations"],
    queryFn: () => api.get<{ activations: Activation[] }>("/me/activations"),
  });

  const activations = data?.activations ?? [];

  return (
    <div>
      <div className="user-feed-header">
        <span className="user-feed-eyebrow">Activity</span>
        <h1 className="user-feed-heading">My Redemptions</h1>
      </div>

      {isLoading && (
        <>
          <div className="user-skeleton-row">
            <div className="user-skeleton-block" style={{ width: 8, height: 8, borderRadius: 99 }} />
            <div style={{ flex: 1 }}>
              <div className="user-skeleton-block" style={{ width: "60%", height: 12 }} />
            </div>
          </div>
        </>
      )}

      {!isLoading && activations.length === 0 && (
        <div className="user-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9" />
            <path d="M12 8v4l2.5 2.5" />
          </svg>
          <p>Nothing redeemed yet. Your history will show up here.</p>
        </div>
      )}

      {activations.length > 0 && (
        <div className="user-history-list">
          {activations.map((a) => (
            <div key={a.id} className="user-history-row">
              <span className={`user-status-dot${a.status === "ACTIVE" ? " is-active" : ""}`} />
              <span className="user-history-meta">
                <span className="user-history-title">{a.offerTitle}</span>
                <span className="user-history-vendor">{a.vendorName}</span>
              </span>
              <span className="user-history-date">
                {new Date(a.redeemedAt ?? a.activatedAt).toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
