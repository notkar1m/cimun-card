interface RedeemedCardProps {
  offerTitle: string;
  vendorName: string;
  redeemedAt: string;
  userName?: string | null;
}

export function RedeemedCard({ offerTitle, vendorName, redeemedAt, userName }: RedeemedCardProps) {
  const date = new Date(redeemedAt);

  return (
    <div className="redeemed-card">
      <div className="redeemed-card-top">
        <span className="redeemed-card-brand">CIMUN CARD</span>
        <span className="redeemed-card-badge">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 13l4 4L19 7" />
          </svg>
          Verified
        </span>
      </div>

      <div>
        <p className="redeemed-card-title">{offerTitle}</p>
        <p className="redeemed-card-vendor">{vendorName}</p>
        {userName && <p className="redeemed-card-name">{userName}</p>}
      </div>

      <div className="redeemed-card-footer">
        <span>
          {date.toLocaleDateString(undefined, { month: "short", day: "numeric" })} &middot;{" "}
          {date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
        </span>
        <span className="redeemed-card-monogram">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="8.5" />
            <path d="M9 12.2l2 2 4-4.4" />
          </svg>
        </span>
      </div>
    </div>
  );
}
