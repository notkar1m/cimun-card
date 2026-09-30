import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
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

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

function DiamondBadge() {
  return (
    <span className="user-diamond-badge">
      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2 4 9l8 13 8-13-8-7Z" />
      </svg>
      Diamond
    </span>
  );
}

function DiamondCard({ offer }: { offer: Offer }) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = imageFailed ? null : offerImageSrc(offer);

  return (
    <Link to={`/app/offers/${offer.id}`} className="user-diamond-card">
      {src ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
      ) : (
        <span className="user-diamond-monogram">{initials(offer.vendorName)}</span>
      )}
      <span className="user-diamond-scrim" />
      <DiamondBadge />
      {offer.discountPercent != null && (
        <span className="user-discount-badge">{offer.discountPercent}% OFF</span>
      )}
      <span className="user-diamond-body">
        <span className="user-diamond-vendor">{offer.vendorName}</span>
        <span className="user-diamond-title">{offer.title}</span>
      </span>
    </Link>
  );
}

function GridCard({ offer }: { offer: Offer }) {
  const [imageFailed, setImageFailed] = useState(false);
  const src = imageFailed ? null : offerImageSrc(offer);

  return (
    <Link to={`/app/offers/${offer.id}`} className="user-grid-card">
      <span className="user-grid-card-image">
        {src ? (
          <img src={src} alt="" loading="lazy" decoding="async" onError={() => setImageFailed(true)} />
        ) : (
          initials(offer.vendorName)
        )}
        {offer.discountPercent != null && (
          <span className="user-discount-badge">{offer.discountPercent}% OFF</span>
        )}
      </span>
      <span className="user-grid-card-body">
        <span className="user-grid-card-vendor">{offer.vendorName}</span>
        <span className="user-grid-card-title">{offer.title}</span>
      </span>
    </Link>
  );
}

function FeedSkeleton() {
  return (
    <>
      <div className="user-skeleton-block" style={{ aspectRatio: "2.1 / 1", borderRadius: 16, marginBottom: 18 }} />
      <div className="user-offer-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="user-skeleton-block" style={{ aspectRatio: "0.82 / 1", borderRadius: 16 }} />
        ))}
      </div>
    </>
  );
}

export function HomeFeed() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["offers"],
    queryFn: () => api.get<{ offers: Offer[] }>("/offers"),
  });

  const offers = data?.offers ?? [];
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => o.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [offers]);

  function toggleTag(tag: string) {
    setSelectedTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  }

  const filteredOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return offers.filter((o) => {
      if (selectedTags.length > 0 && !o.tags.some((t) => selectedTags.includes(t))) return false;
      if (q && !o.title.toLowerCase().includes(q) && !o.vendorName.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [offers, selectedTags, searchQuery]);

  const { diamondOffers, gridOffers } = useMemo(
    () => ({
      diamondOffers: filteredOffers.filter((o) => o.tier === "DIAMOND"),
      // Gold and Silver share one grid; the backend already orders Gold
      // ahead of Silver, so no extra client-side sort is needed here.
      gridOffers: filteredOffers.filter((o) => o.tier !== "DIAMOND"),
    }),
    [filteredOffers]
  );

  return (
    <div>
      <div className="user-feed-header">
        <span className="user-feed-eyebrow">Delegate benefits</span>
        <h1 className="user-feed-heading">Your offers</h1>
      </div>

      {!isLoading && !error && offers.length > 0 && (
        <div className="user-search-bar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search offers or vendors..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button type="button" className="user-search-clear" onClick={() => setSearchQuery("")} aria-label="Clear search">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          )}
        </div>
      )}

      {isLoading && <FeedSkeleton />}

      {error && <p className="alert alert-error">Couldn't load offers. Pull to refresh.</p>}

      {!isLoading && !error && offers.length === 0 && (
        <div className="user-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="6" width="18" height="13" rx="2.5" />
            <path d="M3 10.5h18" />
          </svg>
          <p>No offers are live right now. Check back soon.</p>
        </div>
      )}

      {!isLoading && offers.length > 0 && allTags.length > 0 && (
        <div className="user-tag-filter">
          <button
            type="button"
            className={`user-tag-pill${selectedTags.length === 0 ? " active" : ""}`}
            onClick={() => setSelectedTags([])}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`user-tag-pill${selectedTags.includes(tag) ? " active" : ""}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {!isLoading && offers.length > 0 && filteredOffers.length === 0 && (
        <div className="user-empty">
          <p>No offers match these filters.</p>
        </div>
      )}

      {!isLoading && diamondOffers.length > 0 && (
        <div className="user-diamond-list">
          {diamondOffers.map((offer) => (
            <DiamondCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {!isLoading && gridOffers.length > 0 && (
        <div className="user-offer-grid">
          {gridOffers.map((offer) => (
            <GridCard key={offer.id} offer={offer} />
          ))}
        </div>
      )}
    </div>
  );
}
