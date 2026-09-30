import { useState } from "react";

interface PromoCodeRevealProps {
  offerTitle: string;
  vendorName: string;
  promoCode: string;
}

export function PromoCodeReveal({ offerTitle, vendorName, promoCode }: PromoCodeRevealProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(promoCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // clipboard API unavailable — the code is still visible to copy by hand
    }
  }

  return (
    <div className="promo-card">
      <p className="promo-eyebrow">{vendorName}</p>
      <p className="promo-title">{offerTitle}</p>
      <p className="promo-hint">Use this code to redeem your offer</p>
      <div className="promo-code-box">
        <span className="promo-code-text">{promoCode}</span>
        <button type="button" className="promo-copy-btn" onClick={handleCopy}>
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
