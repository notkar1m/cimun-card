import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import { Button, Spinner, TextInput } from "../../components/ui";
import { SortIcon } from "../../components/icons";
import { CsvImportModal, type CsvColumn } from "../../components/CsvImportModal";
import { ReorderOffersModal } from "../../components/ReorderOffersModal";

const OFFER_CSV_COLUMNS: CsvColumn[] = [
  { name: "title", note: "required" },
  { name: "description", note: "required" },
  { name: "vendorName", note: "required" },
  { name: "tier", note: "SILVER, GOLD, or DIAMOND — defaults to GOLD" },
  { name: "discountPercent", note: "whole number 1-100 — optional" },
  { name: "tags", note: "semicolon-separated, e.g. Food;Beverages — optional" },
  { name: "imageUrl", note: "optional" },
  { name: "redemptionType", note: "CARD or PROMO — defaults to CARD" },
  { name: "promoCode", note: "required if redemptionType is PROMO" },
  { name: "active", note: "true or false — defaults to true" },
];

interface AdminOffer {
  id: string;
  title: string;
  active: boolean;
  redemptionType: "CARD" | "PROMO";
  vendorName: string;
  tier: "SILVER" | "GOLD" | "DIAMOND";
  sortOrder: number;
  discountPercent: number | null;
  _count: { activations: number };
}

type SortField = "title" | "vendor" | "tier" | "discount" | "status" | "activations";
type SortDirection = "asc" | "desc";
type StatusFilter = "all" | "active" | "inactive";
type TierFilter = "all" | "SILVER" | "GOLD" | "DIAMOND";

const TIER_LABEL: Record<AdminOffer["tier"], string> = {
  DIAMOND: "Diamond",
  GOLD: "Gold",
  SILVER: "Silver",
};

const TIER_BADGE_CLASS: Record<AdminOffer["tier"], string> = {
  DIAMOND: "badge-diamond",
  GOLD: "badge-gold",
  SILVER: "badge-silver",
};

export function OffersList() {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "offers"],
    queryFn: () => api.get<{ offers: AdminOffer[] }>("/admin/offers"),
  });

  const offers = data?.offers ?? [];
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [showReorderModal, setShowReorderModal] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const [vendorFilter, setVendorFilter] = useState<string>("all");
  const [sortField, setSortField] = useState<SortField>("activations");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const vendorOptions = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => set.add(o.vendorName));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [offers]);

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection(field === "activations" ? "desc" : "asc");
    }
  }

  const visibleOffers = useMemo(() => {
    const q = query.trim().toLowerCase();

    const filtered = offers.filter((o) => {
      if (q && !o.title.toLowerCase().includes(q) && !o.vendorName.toLowerCase().includes(q)) {
        return false;
      }
      if (statusFilter === "active" && !o.active) return false;
      if (statusFilter === "inactive" && o.active) return false;
      if (tierFilter !== "all" && o.tier !== tierFilter) return false;
      if (vendorFilter !== "all" && o.vendorName !== vendorFilter) return false;
      return true;
    });

    const dir = sortDirection === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortField) {
        case "title":
          return a.title.localeCompare(b.title) * dir;
        case "vendor":
          return a.vendorName.localeCompare(b.vendorName) * dir;
        case "tier":
          return a.tier.localeCompare(b.tier) * dir;
        case "discount":
          return ((a.discountPercent ?? -1) - (b.discountPercent ?? -1)) * dir;
        case "status":
          return (Number(a.active) - Number(b.active)) * dir;
        case "activations":
          return (a._count.activations - b._count.activations) * dir;
        default:
          return 0;
      }
    });
  }, [offers, query, statusFilter, tierFilter, vendorFilter, sortField, sortDirection]);

  const totalActivations = useMemo(
    () => visibleOffers.reduce((sum, o) => sum + o._count.activations, 0),
    [visibleOffers]
  );

  function sortHeader(field: SortField, label: string) {
    return (
      <th
        onClick={() => toggleSort(field)}
        style={{ cursor: "pointer", userSelect: "none", whiteSpace: "nowrap" }}
      >
        {label}
        <SortIcon direction={sortField === field ? sortDirection : undefined} />
      </th>
    );
  }

  return (
    <div>
      <div className="space-between">
        <h1>Offers</h1>
        <div className="row">
          <Button variant="secondary" onClick={() => setShowReorderModal(true)} disabled={offers.length === 0}>
            Reorder
          </Button>
          <Button variant="secondary" onClick={() => setShowCsvModal(true)}>
            Upload CSV
          </Button>
          <Link to="/admin/offers/new">
            <Button>New offer</Button>
          </Link>
        </div>
      </div>

      {showCsvModal && (
        <CsvImportModal
          title="Upload offers from CSV"
          endpoint="/admin/offers/bulk-import"
          columns={OFFER_CSV_COLUMNS}
          resultNoun="offer"
          onClose={() => setShowCsvModal(false)}
          onImported={() => queryClient.invalidateQueries({ queryKey: ["admin", "offers"] })}
        />
      )}

      {showReorderModal && (
        <ReorderOffersModal
          offers={offers}
          onClose={() => setShowReorderModal(false)}
          onReordered={() => queryClient.invalidateQueries({ queryKey: ["admin", "offers"] })}
        />
      )}

      {isLoading ? (
        <Spinner />
      ) : offers.length === 0 ? (
        <div className="card">
          <p className="muted" style={{ margin: 0 }}>
            No offers yet. Create one to get started.
          </p>
        </div>
      ) : (
        <>
          <div className="card filter-bar">
            <div className="filter-bar-search">
              <TextInput
                id="offerSearch"
                label="Search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Title or vendor..."
              />
            </div>
            <div className="field">
              <label htmlFor="statusFilter">Status</label>
              <select
                id="statusFilter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="tierFilter">Tier</label>
              <select
                id="tierFilter"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value as TierFilter)}
              >
                <option value="all">All</option>
                <option value="DIAMOND">Diamond</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="vendorFilter">Vendor</label>
              <select
                id="vendorFilter"
                value={vendorFilter}
                onChange={(e) => setVendorFilter(e.target.value)}
              >
                <option value="all">All</option>
                {vendorOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <p className="muted" style={{ marginBottom: 10 }}>
            {visibleOffers.length} offer{visibleOffers.length === 1 ? "" : "s"} &middot; {totalActivations}{" "}
            total activation{totalActivations === 1 ? "" : "s"}
          </p>

          {visibleOffers.length === 0 ? (
            <div className="card">
              <p className="muted" style={{ margin: 0 }}>
                No offers match these filters.
              </p>
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  {sortHeader("title", "Title")}
                  {sortHeader("vendor", "Vendor")}
                  {sortHeader("tier", "Tier")}
                  {sortHeader("discount", "Discount")}
                  {sortHeader("status", "Status")}
                  {sortHeader("activations", "Activations")}
                  <th />
                </tr>
              </thead>
              <tbody>
                {visibleOffers.map((o) => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.title}</td>
                    <td>{o.vendorName}</td>
                    <td>
                      <span className={`badge ${TIER_BADGE_CLASS[o.tier]}`}>{TIER_LABEL[o.tier]}</span>
                    </td>
                    <td>{o.discountPercent != null ? `${o.discountPercent}%` : <span className="muted">—</span>}</td>
                    <td>
                      <span className={`badge ${o.active ? "badge-success" : "badge-neutral"}`}>
                        {o.active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>{o._count.activations}</td>
                    <td>
                      <Link to={`/admin/offers/${o.id}/edit`}>Edit</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
}
