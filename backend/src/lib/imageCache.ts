interface CachedImage {
  contentType: string;
  buffer: Buffer;
}

const MAX_ENTRIES = 200;
const MAX_BYTES = 5 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 8000;

const cache = new Map<string, CachedImage>();
// Every delegate loading the feed for the first time asks for the same
// handful of offer images at once. Without this, an uncached image gets
// fetched from its third-party host once per concurrent request instead of
// once total — at a couple thousand concurrent devices that's a couple
// thousand redundant outbound fetches for the same file, fired in the same
// few milliseconds. Concurrent callers for the same URL instead share one
// in-flight fetch and its result.
const inFlight = new Map<string, Promise<CachedImage | null>>();

// Delegate phones often sit on slow or high-latency connections. Offer
// images are hotlinked from whatever URL an admin pasted in, each on its
// own third-party host — every distinct host costs a fresh DNS + TLS
// round trip on the client. Fetching once here and re-serving from our own
// origin (with long client-side caching) collapses that down to a single
// origin and a single round trip after the first view.
export async function getCachedImage(url: string): Promise<CachedImage | null> {
  const existing = cache.get(url);
  if (existing) return existing;

  const pending = inFlight.get(url);
  if (pending) return pending;

  const promise = fetchAndCache(url).finally(() => inFlight.delete(url));
  inFlight.set(url, promise);
  return promise;
}

async function fetchAndCache(url: string): Promise<CachedImage | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return null;

    const arrayBuffer = await res.arrayBuffer();
    if (arrayBuffer.byteLength === 0 || arrayBuffer.byteLength > MAX_BYTES) return null;

    const entry: CachedImage = { contentType, buffer: Buffer.from(arrayBuffer) };

    if (cache.size >= MAX_ENTRIES) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey !== undefined) cache.delete(oldestKey);
    }
    cache.set(url, entry);

    return entry;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
