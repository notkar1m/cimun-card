export interface LatLng {
  lat: number;
  lng: number;
}

const COORD_PATTERNS = [
  /@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // .../@30.0444,31.2357,17z
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place details: !3d<lat>!4d<lng>
  /[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // ?q=30.0444,31.2357
  /[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/, // ?ll=30.0444,31.2357
];

const BARE_COORD_PATTERN = /^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/;

const SHORT_LINK_HOSTS = ["maps.app.goo.gl", "goo.gl", "g.co", "app.goo.gl"];

const GOOGLE_MAPS_HOSTS_PATTERN = /(^|\.)(google\.[a-z.]+|goo\.gl|g\.co)$/;

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}

function extractCoords(text: string, patterns: RegExp[]): LatLng | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const lat = Number(match[1]);
      const lng = Number(match[2]);
      if (isValidLatLng(lat, lng)) {
        return { lat, lng };
      }
    }
  }
  return null;
}

function isGoogleMapsHost(hostname: string): boolean {
  return GOOGLE_MAPS_HOSTS_PATTERN.test(hostname) || SHORT_LINK_HOSTS.includes(hostname);
}

// Delegates just paste whatever Google Maps gives them: a full URL with
// coordinates already in it, a short share link (maps.app.goo.gl/...) that
// resolves to one, or literally just a "lat, lng" pair copied from a
// right-click. Handle all three.
//
// Deliberately NOT handled: scraping the resolved page's HTML for an
// embedded coordinate when the URL itself doesn't have one. That was tried
// and removed — Google serves a generic, non-JS fallback page for this kind
// of server-side fetch, and it embeds the same placeholder "center" for
// every query regardless of the actual place, which silently produced
// wrong pins. Returning null here (and asking the admin for a link that
// resolves to real coordinates) beats a confident wrong answer.
export async function resolveLatLngFromText(input: string): Promise<LatLng | null> {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const bareMatch = trimmed.match(BARE_COORD_PATTERN);
  if (bareMatch) {
    const lat = Number(bareMatch[1]);
    const lng = Number(bareMatch[2]);
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  const urlMatch = trimmed.match(/https?:\/\/\S+/);
  if (!urlMatch) return null;
  const url = urlMatch[0];

  const direct = extractCoords(url, COORD_PATTERNS);
  if (direct) return direct;

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }

  if (!isGoogleMapsHost(host)) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: { "User-Agent": BROWSER_USER_AGENT },
    });
    clearTimeout(timeout);

    return extractCoords(res.url, COORD_PATTERNS);
  } catch {
    return null;
  }
}

// One CSV row, already split into cells: try each cell as a link/bare
// coordinate first (covers a single "location" column, in any column
// position), then fall back to reading the last two numeric-looking cells
// as separate lat/lng columns (covers "name,lat,lng"-style exports).
export async function resolveLatLngFromCsvRow(cells: string[]): Promise<LatLng | null> {
  for (const cell of cells) {
    const coords = await resolveLatLngFromText(cell);
    if (coords) return coords;
  }

  const numeric = cells
    .map((c) => c.trim())
    .filter((c) => /^-?\d+(?:\.\d+)?$/.test(c))
    .map(Number);
  if (numeric.length >= 2) {
    const lat = numeric[numeric.length - 2];
    const lng = numeric[numeric.length - 1];
    if (isValidLatLng(lat, lng)) return { lat, lng };
  }

  return null;
}
