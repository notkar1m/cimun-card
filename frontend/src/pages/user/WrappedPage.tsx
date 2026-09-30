import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import { Button } from "../../components/ui";

interface WrappedStats {
  totalRedeemed: number;
  topVendor: { name: string; count: number } | null;
  tierBreakdown: { tier: "DIAMOND" | "GOLD" | "SILVER"; count: number }[];
  topTag: { tag: string; count: number } | null;
  firstRedeemedAt: string | null;
}

const TIER_LABEL: Record<string, string> = {
  DIAMOND: "Diamond",
  GOLD: "Gold",
  SILVER: "Silver",
};

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

interface Slide {
  key: string;
  tone: "navy" | "sage" | "gold";
  content: React.ReactNode;
}

function buildSlides(stats: WrappedStats, delegateName: string): Slide[] {
  const slides: Slide[] = [
    {
      key: "intro",
      tone: "navy",
      content: (
        <>
          <span className="wrapped-eyebrow">Cimun Card Wrapped</span>
          <h1 className="wrapped-headline">
            Hey {firstName(delegateName)} &mdash; here's your conference, in offers.
          </h1>
          <p className="wrapped-sub">Tap through for your recap.</p>
        </>
      ),
    },
    {
      key: "total",
      tone: "sage",
      content: (
        <>
          <span className="wrapped-eyebrow">The headline number</span>
          <p className="wrapped-big-number">{stats.totalRedeemed}</p>
          <h1 className="wrapped-headline">
            offer{stats.totalRedeemed === 1 ? "" : "s"} redeemed this conference.
          </h1>
        </>
      ),
    },
  ];

  if (stats.topVendor) {
    slides.push({
      key: "top-vendor",
      tone: "gold",
      content: (
        <>
          <span className="wrapped-eyebrow">Your most-visited spot</span>
          <h1 className="wrapped-headline">{stats.topVendor.name}</h1>
          <p className="wrapped-sub">
            {stats.topVendor.count} redemption{stats.topVendor.count === 1 ? "" : "s"} &mdash; you clearly
            knew where to go.
          </p>
        </>
      ),
    });
  }

  if (stats.tierBreakdown.length > 0) {
    const maxCount = Math.max(...stats.tierBreakdown.map((t) => t.count));
    slides.push({
      key: "tiers",
      tone: "navy",
      content: (
        <>
          <span className="wrapped-eyebrow">Where you spent it</span>
          <h1 className="wrapped-headline" style={{ marginBottom: 28 }}>
            Your tier breakdown
          </h1>
          <div className="wrapped-bars">
            {stats.tierBreakdown.map((t) => (
              <div className="wrapped-bar-row" key={t.tier}>
                <span className="wrapped-bar-label">{TIER_LABEL[t.tier]}</span>
                <div className="wrapped-bar-track">
                  <div
                    className={`wrapped-bar-fill wrapped-bar-${t.tier.toLowerCase()}`}
                    style={{ width: `${Math.max(12, (t.count / maxCount) * 100)}%` }}
                  />
                </div>
                <span className="wrapped-bar-count">{t.count}</span>
              </div>
            ))}
          </div>
        </>
      ),
    });
  }

  if (stats.topTag) {
    slides.push({
      key: "top-tag",
      tone: "sage",
      content: (
        <>
          <span className="wrapped-eyebrow">Your vibe this conference</span>
          <h1 className="wrapped-headline">You're a {stats.topTag.tag} person.</h1>
          <p className="wrapped-sub">
            {stats.topTag.count} of your redemptions were tagged {stats.topTag.tag}.
          </p>
        </>
      ),
    });
  }

  slides.push({
    key: "closing",
    tone: "navy",
    content: (
      <>
        <span className="wrapped-eyebrow">That's a wrap</span>
        <h1 className="wrapped-headline">Thanks for being part of CIMUN.</h1>
        <p className="wrapped-sub">
          {stats.firstRedeemedAt
            ? `Your first redemption was ${new Date(stats.firstRedeemedAt).toLocaleDateString(undefined, {
                month: "long",
                day: "numeric",
              })}. See you at the next one.`
            : "See you at the next one."}
        </p>
      </>
    ),
  });

  return slides;
}

export function WrappedPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);

  const { data, isLoading, error } = useQuery({
    queryKey: ["wrapped"],
    queryFn: () => api.get<{ stats: WrappedStats }>("/wrapped"),
    retry: false,
  });

  const slides = useMemo(() => {
    if (!data?.stats || !user) return [];
    return buildSlides(data.stats, user.name);
  }, [data, user]);

  function close() {
    navigate("/app/account");
  }

  function goNext() {
    setIndex((i) => (i >= slides.length - 1 ? i : i + 1));
  }

  function goPrev() {
    setIndex((i) => Math.max(0, i - 1));
  }

  function handleTap(e: React.MouseEvent<HTMLDivElement>) {
    const x = e.clientX;
    const width = e.currentTarget.clientWidth;
    if (x < width * 0.35) {
      goPrev();
    } else if (index >= slides.length - 1) {
      close();
    } else {
      goNext();
    }
  }

  if (isLoading) {
    return <div className="wrapped-shell wrapped-navy page-loading">Loading your wrap...</div>;
  }

  if (error || !data?.stats) {
    return (
      <div className="wrapped-shell wrapped-navy">
        <div className="wrapped-tap-layer" style={{ cursor: "default" }}>
          <div className="wrapped-slide">
            <span className="wrapped-eyebrow">Not available</span>
            <h1 className="wrapped-headline">We couldn't load your Cimun Card Wrapped.</h1>
            <Link to="/app/account" className="wrapped-close-link">
              Back to Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (data.stats.totalRedeemed === 0) {
    return (
      <div className="wrapped-shell wrapped-navy">
        <button type="button" className="wrapped-close" onClick={close} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
        <div className="wrapped-tap-layer" style={{ cursor: "default" }}>
          <div className="wrapped-slide">
            <span className="wrapped-eyebrow">Cimun Card Wrapped</span>
            <h1 className="wrapped-headline">No redemptions yet &mdash; your wrap is waiting.</h1>
            <p className="wrapped-sub">Claim your first offer and come back to see your recap.</p>
            <Link to="/app/home">
              <Button style={{ marginTop: 20 }}>Browse offers</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const slide = slides[index];

  return (
    <div className={`wrapped-shell wrapped-${slide.tone}`}>
      <div className="wrapped-progress">
        {slides.map((s, i) => (
          <span key={s.key} className={`wrapped-progress-seg${i <= index ? " filled" : ""}`} />
        ))}
      </div>
      <button type="button" className="wrapped-close" onClick={close} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      <div className="wrapped-tap-layer" onClick={handleTap}>
        <div className="wrapped-slide" key={slide.key}>
          {slide.content}
        </div>
      </div>
    </div>
  );
}
