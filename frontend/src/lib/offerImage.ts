import { API_BASE } from "../api/client";

interface OfferImageSource {
  id: string;
  imageUrl: string | null;
  updatedAt: string;
}

// Routes through our own image proxy/cache instead of hotlinking whatever
// third-party host the admin pasted in. The updatedAt query param busts the
// long-lived browser cache whenever the offer (and thus its image) changes.
export function offerImageSrc(offer: OfferImageSource): string | null {
  if (!offer.imageUrl) return null;
  return `${API_BASE}/offers/${offer.id}/image?v=${encodeURIComponent(offer.updatedAt)}`;
}
