import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../../api/client";
import { isApiError } from "../../auth/AuthContext";
import { Alert, Button, TextInput } from "../../components/ui";
import { TagInput } from "../../components/TagInput";
import { BranchEditor, type BranchDraft } from "../../components/BranchEditor";

type RedemptionType = "CARD" | "PROMO";
type Tier = "SILVER" | "GOLD" | "DIAMOND";

interface OfferDetail {
  id: string;
  title: string;
  description: string;
  vendorName: string;
  tier: Tier;
  discountPercent: number | null;
  imageUrl: string | null;
  active: boolean;
  redemptionType: RedemptionType;
  promoCode: string | null;
  tags: string[];
  branches: { id: string; label: string | null; lat: number; lng: number }[];
  _count: { activations: number };
}

export function OfferForm() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const navigate = useNavigate();

  const { data: offersData } = useQuery({
    queryKey: ["admin", "offers"],
    queryFn: () => api.get<{ offers: OfferDetail[] }>("/admin/offers"),
  });

  const tagSuggestions = useMemo(() => {
    const all = (offersData?.offers ?? []).flatMap((o) => o.tags);
    return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
  }, [offersData]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [vendorName, setVendorName] = useState("");
  const [tier, setTier] = useState<Tier>("GOLD");
  const [discountPercent, setDiscountPercent] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [active, setActive] = useState(true);
  const [redemptionType, setRedemptionType] = useState<RedemptionType>("CARD");
  const [promoCode, setPromoCode] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [branches, setBranches] = useState<BranchDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isEdit && offersData) {
      const offer = offersData.offers.find((o) => o.id === id);
      if (offer) {
        setTitle(offer.title);
        setDescription(offer.description);
        setVendorName(offer.vendorName);
        setTier(offer.tier);
        setDiscountPercent(offer.discountPercent != null ? String(offer.discountPercent) : "");
        setImageUrl(offer.imageUrl ?? "");
        setActive(offer.active);
        setRedemptionType(offer.redemptionType);
        setPromoCode(offer.promoCode ?? "");
        setTags(offer.tags);
        setBranches(
          offer.branches.map((b) => ({
            label: b.label ?? "",
            input: `${b.lat}, ${b.lng}`,
            lat: b.lat,
            lng: b.lng,
          }))
        );
      }
    }
  }, [isEdit, offersData, id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const branchPayload: { label: string; lat: number; lng: number }[] = [];
    for (let i = 0; i < branches.length; i++) {
      const b = branches[i];
      const hasLabel = b.label.trim().length > 0;
      const hasInput = b.input.trim().length > 0;
      if (!hasLabel && !hasInput) continue;

      if (!hasLabel) {
        setError(`Branch ${i + 1} needs a label (e.g. "Zamalek").`);
        return;
      }
      if (b.lat == null || b.lng == null) {
        setError(`Branch ${i + 1} doesn't have a resolved location yet — check the link or wait for it to finish.`);
        return;
      }
      branchPayload.push({ label: b.label.trim(), lat: b.lat, lng: b.lng });
    }

    setSubmitting(true);
    const trimmedDiscount = discountPercent.trim();
    const payload = {
      title,
      description,
      vendorName,
      tier,
      discountPercent: trimmedDiscount === "" ? (isEdit ? null : undefined) : Number(trimmedDiscount),
      imageUrl: imageUrl || undefined,
      active,
      redemptionType,
      promoCode: redemptionType === "PROMO" ? promoCode : undefined,
      tags,
      branches: branchPayload,
    };
    try {
      if (isEdit) {
        await api.patch(`/admin/offers/${id}`, payload);
      } else {
        await api.post("/admin/offers", payload);
      }
      navigate("/admin/offers");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    const activationCount = offersData?.offers.find((o) => o.id === id)?._count.activations ?? 0;
    const message =
      activationCount > 0
        ? `Delete this offer? It has ${activationCount} activation${activationCount === 1 ? "" : "s"} — that redemption history will be permanently deleted too.`
        : "Delete this offer?";
    if (!confirm(message)) return;
    setError(null);
    try {
      await api.delete(`/admin/offers/${id}`);
      navigate("/admin/offers");
    } catch (err) {
      setError(isApiError(err) ? err.message : "Something went wrong");
    }
  }

  return (
    <div className="page-narrow" style={{ padding: "8px 16px" }}>
      <h1>{isEdit ? "Edit offer" : "New offer"}</h1>
      {error && <Alert type="error">{error}</Alert>}
      <form onSubmit={handleSubmit} className="card">
        <TextInput
          id="title"
          label="Title"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <div className="field">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            required
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <TextInput
          id="vendorName"
          label="Vendor"
          required
          value={vendorName}
          onChange={(e) => setVendorName(e.target.value)}
        />
        <div className="field">
          <label htmlFor="tier">Tier</label>
          <select id="tier" value={tier} onChange={(e) => setTier(e.target.value as Tier)}>
            <option value="SILVER">Silver</option>
            <option value="GOLD">Gold</option>
            <option value="DIAMOND">Diamond</option>
          </select>
        </div>

        <TextInput
          id="discountPercent"
          label="Discount % (optional)"
          type="number"
          min={1}
          max={100}
          step={1}
          value={discountPercent}
          onChange={(e) => setDiscountPercent(e.target.value)}
        />

        <TagInput value={tags} onChange={setTags} suggestions={tagSuggestions} />

        <BranchEditor value={branches} onChange={setBranches} />

        <TextInput
          id="imageUrl"
          label="Image URL (optional)"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <div className="field">
          <label htmlFor="redemptionType">Redemption type</label>
          <select
            id="redemptionType"
            value={redemptionType}
            onChange={(e) => setRedemptionType(e.target.value as RedemptionType)}
          >
            <option value="CARD">Show card</option>
            <option value="PROMO">Show promo code</option>
          </select>
        </div>
        {redemptionType === "PROMO" && (
          <TextInput
            id="promoCode"
            label="Promo code"
            required
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
          />
        )}
        <div className="field">
          <label>
            <input
              type="checkbox"
              checked={active}
              onChange={(e) => setActive(e.target.checked)}
              style={{ marginRight: 8 }}
            />
            Active (visible in the feed)
          </label>
        </div>
        <div className="row">
          <Button type="submit" disabled={submitting || !vendorName}>
            {submitting ? "Saving..." : "Save"}
          </Button>
          {isEdit && (
            <Button type="button" variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
