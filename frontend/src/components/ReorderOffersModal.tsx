import { useMemo, useState } from "react";
import { api } from "../api/client";
import { isApiError } from "../auth/AuthContext";
import { Alert, Modal } from "./ui";

type Tier = "SILVER" | "GOLD" | "DIAMOND";

interface ReorderOffer {
  id: string;
  title: string;
  vendorName: string;
  tier: Tier;
  sortOrder: number;
}

const TIER_SECTIONS: { tier: Tier; label: string; hint: string }[] = [
  {
    tier: "DIAMOND",
    label: "Diamond",
    hint: "Each gets its own full-width banner, in this order.",
  },
  {
    tier: "GOLD",
    label: "Gold",
    hint: "Shares a grid with Silver on the delegate's feed. Gold always shows before Silver.",
  },
  {
    tier: "SILVER",
    label: "Silver",
    hint: "Same grid as Gold, always listed after it.",
  },
];

function DragHandleIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="9" cy="6" r="1.6" />
      <circle cx="15" cy="6" r="1.6" />
      <circle cx="9" cy="12" r="1.6" />
      <circle cx="15" cy="12" r="1.6" />
      <circle cx="9" cy="18" r="1.6" />
      <circle cx="15" cy="18" r="1.6" />
    </svg>
  );
}

export function ReorderOffersModal({
  offers,
  onClose,
  onReordered,
}: {
  offers: ReorderOffer[];
  onClose: () => void;
  onReordered: () => void;
}) {
  const initialByTier = useMemo(() => {
    const grouped: Record<Tier, ReorderOffer[]> = { DIAMOND: [], GOLD: [], SILVER: [] };
    for (const offer of offers) {
      grouped[offer.tier].push(offer);
    }
    for (const tier of Object.keys(grouped) as Tier[]) {
      grouped[tier].sort((a, b) => a.sortOrder - b.sortOrder);
    }
    return grouped;
  }, [offers]);

  const [byTier, setByTier] = useState(initialByTier);
  const [dragId, setDragId] = useState<string | null>(null);
  const [savingTier, setSavingTier] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persistOrder(tier: Tier, ordered: ReorderOffer[]) {
    setSavingTier(tier);
    setError(null);
    try {
      await api.post("/admin/offers/reorder", {
        tier,
        orderedIds: ordered.map((o) => o.id),
      });
      onReordered();
    } catch (err) {
      setError(isApiError(err) ? err.message : "Couldn't save the new order");
    } finally {
      setSavingTier(null);
    }
  }

  function handleDrop(tier: Tier, targetId: string) {
    if (!dragId || dragId === targetId) return;
    const current = byTier[tier];
    const fromIndex = current.findIndex((o) => o.id === dragId);
    const toIndex = current.findIndex((o) => o.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const reordered = [...current];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    setByTier((prev) => ({ ...prev, [tier]: reordered }));
    setDragId(null);
    persistOrder(tier, reordered);
  }

  return (
    <Modal title="Reorder sponsors" onClose={onClose}>
      <p className="muted" style={{ marginTop: -4 }}>
        Drag within a tier to change which sponsor the delegate sees first.
      </p>

      {error && <Alert type="error">{error}</Alert>}

      {TIER_SECTIONS.map(({ tier, label, hint }) => {
        const tierOffers = byTier[tier];
        if (tierOffers.length === 0) return null;
        return (
          <div key={tier} className="reorder-section">
            <div className="reorder-section-header">
              <span className={`badge ${tier === "DIAMOND" ? "badge-diamond" : tier === "GOLD" ? "badge-gold" : "badge-silver"}`}>
                {label}
              </span>
              {savingTier === tier && <span className="muted">Saving...</span>}
            </div>
            <p className="reorder-hint">{hint}</p>
            <ul className="reorder-list">
              {tierOffers.map((offer) => (
                <li
                  key={offer.id}
                  className="reorder-row"
                  draggable
                  onDragStart={() => setDragId(offer.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(tier, offer.id)}
                >
                  <span className="reorder-handle">
                    <DragHandleIcon />
                  </span>
                  <span className="reorder-row-text">
                    <span className="reorder-row-title">{offer.title}</span>
                    <span className="reorder-row-vendor">{offer.vendorName}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </Modal>
  );
}
