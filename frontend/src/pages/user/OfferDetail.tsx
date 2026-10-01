import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button } from "../../components/ui";
import { RedeemedCard } from "../../components/RedeemedCard";
import { PromoCodeReveal } from "../../components/PromoCodeReveal";
import { offerImageSrc } from "../../lib/offerImage";

interface Offer {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  tags: string[];
  vendorName: string;
  tier: "SILVER" | "GOLD" | "DIAMOND";
  discountPercent: number | null;
  updatedAt: string;
}

interface RedeemResult {
  offerTitle: string;
  vendorName: string;
  redeemedAt: string;
  redemptionType: "CARD" | "PROMO";
  promoCode: string | null;
  userName: string | null;
}

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export function OfferDetail() {
  const { id } = useParams<{ id: string }>();
  const [result, setResult] = useState<RedeemResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [redeeming, setRedeeming] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["offer", id],
    queryFn: () => api.get<{ offer: Offer }>(`/offers/${id}`),
    enabled: !!id,
  });

  async function handleRedeem() {
    setError(null);
    setRedeeming(true);
    try {
      const res = await api.post<RedeemResult>(`/offers/${id}/redeem`);
      setResult(res);
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setRedeeming(false);
    }
  }

  if (isLoading) {
    return (
      <div>
        <div className="user-skeleton-block" style={{ aspectRatio: "16/10", borderRadius: 20, marginBottom: 20 }} />
        <div className="user-skeleton-block" style={{ width: "40%", height: 12, marginBottom: 10 }} />
        <div className="user-skeleton-block" style={{ width: "80%", height: 22 }} />
      </div>
    );
  }

  if (!data) return <Alert type="error">Offer not found.</Alert>;

  const { offer } = data;

  if (result && result.redemptionType === "PROMO" && result.promoCode) {
    return (
      <div className="redeemed-reveal">
        <PromoCodeReveal
          offerTitle={result.offerTitle}
          vendorName={result.vendorName}
          promoCode={result.promoCode}
        />
        <div className="redeemed-actions">
          <Link to="/app/home" className="btn btn-secondary">
            Back to offers
          </Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="redeemed-reveal">
        <p className="redeemed-reveal-label">Show this card to the staff</p>
        <RedeemedCard
          offerTitle={result.offerTitle}
          vendorName={result.vendorName}
          redeemedAt={result.redeemedAt}
          userName={result.userName}
        />
        <div className="redeemed-actions">
          <Link to="/app/home" className="btn btn-secondary">
            Back to offers
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Link to="/app/home" className="user-back">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Offers
      </Link>

      <div className="user-hero">
        {!imageFailed && offerImageSrc(offer) ? (
          <img src={offerImageSrc(offer)!} alt="" decoding="async" onError={() => setImageFailed(true)} />
        ) : (
          <span className="user-hero-monogram">{initials(offer.vendorName)}</span>
        )}
        {offer.discountPercent != null && (
          <span className="user-discount-badge">{offer.discountPercent}% OFF</span>
        )}
      </div>

      <p className="user-detail-vendor">{offer.vendorName}</p>
      <h1 className="user-detail-title">{offer.title}</h1>
      {offer.tags.length > 0 && (
        <div className="user-detail-tags">
          {offer.tags.map((tag) => (
            <span key={tag} className="user-tag-pill">
              {tag}
            </span>
          ))}
        </div>
      )}
      <p className="user-detail-body">{offer.description}</p>

      {error && <Alert type="error">{error}</Alert>}

      <div className="user-cta-bar">
        <div className="user-cta-bar-inner">
          <Button onClick={handleRedeem} disabled={redeeming}>
            {redeeming ? "Redeeming..." : "Redeem"}
          </Button>
        </div>
      </div>
    </div>
  );
}
