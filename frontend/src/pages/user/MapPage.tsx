import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../../api/client";
import { Alert } from "../../components/ui";
import { useAppSettings } from "../../lib/useAppSettings";

interface Branch {
  id: string;
  label: string | null;
  lat: number;
  lng: number;
  offerId: string;
  offerTitle: string;
  vendorName: string;
  tier: "SILVER" | "GOLD" | "DIAMOND";
  tags: string[];
}

// Default view centers on downtown Cairo, home of the conference, for the
// (rare) case there are no branches yet to derive a center from.
const CAIRO_CENTER: [number, number] = [30.0444, 31.2357];

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

// "Samir & Aly - Zamalek" when the branch has a label, otherwise just the
// vendor name (older branches saved before labels existed).
function branchDisplayName(branch: Branch): string {
  return branch.label ? `${branch.vendorName} - ${branch.label}` : branch.vendorName;
}

// A classic map-pin silhouette (rounded head, pointed tip) rather than a
// plain dot, so it actually reads as "a pin on a map" at a glance.
function pinIcon(color: string, size: number): L.DivIcon {
  const height = Math.round(size * 1.33);
  return L.divIcon({
    className: "",
    html: `<svg width="${size}" height="${height}" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="${color}" stroke="white" stroke-width="1.5"/>
      <circle cx="12" cy="12" r="4.5" fill="white"/>
    </svg>`,
    iconSize: [size, height],
    iconAnchor: [size / 2, height],
    popupAnchor: [0, -height + 4],
  });
}

const markerIcons: Record<Branch["tier"], L.DivIcon> = {
  DIAMOND: pinIcon("#1c2a47", 30),
  GOLD: pinIcon("#3d7a5e", 28),
  SILVER: pinIcon("#3d7a5e", 28),
};

const youAreHereIcon = L.divIcon({
  className: "",
  html: '<span class="map-you-are-here"><span class="map-you-are-here-pulse"></span><span class="map-you-are-here-dot"></span></span>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function geolocationErrorMessage(err: GeolocationPositionError): string {
  if (err.code === err.PERMISSION_DENIED) {
    // The single most common cause on a phone: the page was opened over
    // plain http from a LAN address rather than https or localhost, which
    // most browsers refuse to grant location access to at all.
    if (typeof window !== "undefined" && window.isSecureContext === false) {
      return "Location needs a secure (https) connection, or you need to allow it in your browser's site settings.";
    }
    return "Location access was denied. Check your browser/phone's site permissions and try again.";
  }
  if (err.code === err.POSITION_UNAVAILABLE) {
    return "Your device couldn't determine a location right now.";
  }
  if (err.code === err.TIMEOUT) {
    return "Finding your location took too long. Try again.";
  }
  return "Couldn't get your location.";
}

// Recenters/refits the map whenever the filtered set of branches changes,
// so searching or picking a tag doesn't leave the view zoomed out over
// mostly-empty space.
function FitBoundsOnChange({ branches }: { branches: Branch[] }) {
  const map = useMap();
  const signature = branches.map((b) => b.id).join(",");

  useEffect(() => {
    if (branches.length === 0) return;
    if (branches.length === 1) {
      map.setView([branches[0].lat, branches[0].lng], 14);
      return;
    }
    const bounds = L.latLngBounds(branches.map((b): [number, number] => [b.lat, b.lng]));
    map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return null;
}

function LocateControl({
  branches,
  onLocate,
  onError,
}: {
  branches: Branch[];
  onLocate: (pos: [number, number]) => void;
  onError: (message: string | null) => void;
}) {
  const map = useMap();
  const [locating, setLocating] = useState(false);

  function handleLocate() {
    onError(null);
    if (!navigator.geolocation) {
      onError("This browser doesn't support location.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const pos: [number, number] = [position.coords.latitude, position.coords.longitude];
        onLocate(pos);
        // Fit both the delegate's own position AND every branch in view,
        // instead of recentering on just one point, so it actually reads
        // as "here's where I am relative to them."
        const bounds = L.latLngBounds([pos, ...branches.map((b): [number, number] => [b.lat, b.lng])]);
        map.flyToBounds(bounds, { padding: [36, 36], maxZoom: 15 });
        setLocating(false);
      },
      (err) => {
        onError(geolocationErrorMessage(err));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  return (
    <button
      type="button"
      className="map-locate-btn"
      onClick={handleLocate}
      aria-label="Show my location"
      title="Show my location"
    >
      {locating ? (
        <span className="map-locate-spinner" />
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
        </svg>
      )}
    </button>
  );
}

export function MapPage() {
  const settings = useAppSettings();
  const { data, isLoading, error } = useQuery({
    queryKey: ["branches"],
    queryFn: () => api.get<{ branches: Branch[] }>("/branches"),
  });

  const branches = data?.branches ?? [];
  const [myLocation, setMyLocation] = useState<[number, number] | null>(null);
  const [locateError, setLocateError] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const allTags = useMemo(() => {
    const set = new Set<string>();
    branches.forEach((b) => b.tags.forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [branches]);

  function toggleTag(tag: string) {
    setSelectedTag((prev) => (prev === tag ? null : tag));
  }

  const filteredBranches = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return branches.filter((b) => {
      if (selectedTag && !b.tags.includes(selectedTag)) return false;
      if (
        q &&
        !b.offerTitle.toLowerCase().includes(q) &&
        !b.vendorName.toLowerCase().includes(q) &&
        !(b.label && b.label.toLowerCase().includes(q))
      ) {
        return false;
      }
      return true;
    });
  }, [branches, selectedTag, searchQuery]);

  const center = useMemo<[number, number]>(() => {
    if (branches.length === 0) return CAIRO_CENTER;
    const lat = branches.reduce((sum, b) => sum + b.lat, 0) / branches.length;
    const lng = branches.reduce((sum, b) => sum + b.lng, 0) / branches.length;
    return [lat, lng];
  }, [branches]);

  if (!settings.mapTabEnabled) {
    return <Navigate to="/app/home" replace />;
  }

  return (
    <div>
      <div className="user-feed-header">
        <span className="user-feed-eyebrow">Delegate benefits</span>
        <h1 className="user-feed-heading">Branch map</h1>
      </div>

      {!isLoading && !error && branches.length > 0 && (
        <div className="user-search-bar">
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            inputMode="search"
            enterKeyHint="search"
            placeholder="Search branches or vendors..."
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

      {isLoading && <div className="user-skeleton-block user-map-card" />}

      {error && <p className="alert alert-error">Couldn't load the map. Pull to refresh.</p>}

      {!isLoading && !error && branches.length === 0 && (
        <div className="user-empty">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11Z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <p>No branch locations yet. Check back soon.</p>
        </div>
      )}

      {!isLoading && branches.length > 0 && allTags.length > 0 && (
        <div className="user-tag-filter">
          <button
            type="button"
            className={`user-tag-pill${selectedTag === null ? " active" : ""}`}
            onClick={() => setSelectedTag(null)}
          >
            All
          </button>
          {allTags.map((tag) => (
            <button
              key={tag}
              type="button"
              className={`user-tag-pill${selectedTag === tag ? " active" : ""}`}
              onClick={() => toggleTag(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {!isLoading && branches.length > 0 && filteredBranches.length === 0 && (
        <div className="user-empty">
          <p>No branches match these filters.</p>
        </div>
      )}

      {!isLoading && !error && filteredBranches.length > 0 && (
        <>
          {locateError && (
            <Alert type="error">{locateError}</Alert>
          )}
          <div className="user-map-card">
            <MapContainer center={center} zoom={12} scrollWheelZoom style={{ height: "100%", width: "100%" }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBoundsOnChange branches={filteredBranches} />
              <LocateControl branches={filteredBranches} onLocate={setMyLocation} onError={setLocateError} />
              {myLocation && (
                <Marker position={myLocation} icon={youAreHereIcon} zIndexOffset={1000}>
                  <Popup>
                    <div className="map-popup">
                      <span className="map-popup-vendor">You are here</span>
                    </div>
                  </Popup>
                </Marker>
              )}
              {filteredBranches.map((b) => (
                <Marker key={b.id} position={[b.lat, b.lng]} icon={markerIcons[b.tier]}>
                  <Popup>
                    <div className="map-popup">
                      <span className="map-popup-vendor">{branchDisplayName(b)}</span>
                      <Link to={`/app/offers/${b.offerId}`} className="map-popup-link">
                        {b.offerTitle} &rarr;
                      </Link>
                      <a
                        href={googleMapsUrl(b.lat, b.lng)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="map-popup-link map-popup-link-external"
                      >
                        Open in Google Maps &#8599;
                      </a>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            {filteredBranches.length} branch{filteredBranches.length === 1 ? "" : "es"} across{" "}
            {new Set(filteredBranches.map((b) => b.vendorName)).size} partner
            {new Set(filteredBranches.map((b) => b.vendorName)).size === 1 ? "" : "s"}. Tap a pin for
            details.
          </p>
        </>
      )}
    </div>
  );
}
