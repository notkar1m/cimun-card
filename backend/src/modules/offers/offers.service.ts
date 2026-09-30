import { prisma } from "../../lib/prisma";
import { ApiError } from "../../lib/ApiError";
import { parseCsv } from "../../lib/csv";
import { resolveLatLngFromCsvRow } from "../../lib/googleMapsLink";
import type { Prisma, RedemptionType, VendorTier } from "@prisma/client";

const publicOfferSelect = {
  id: true,
  title: true,
  description: true,
  discountPercent: true,
  imageUrl: true,
  active: true,
  tags: true,
  vendorName: true,
  tier: true,
  createdAt: true,
  updatedAt: true,
} as const;

function sanitizeTags(tags: string[] | undefined): string[] | undefined {
  if (!tags) return undefined;
  const cleaned = tags.map((t) => t.trim()).filter((t) => t.length > 0 && t.length <= 30);
  return Array.from(new Set(cleaned)).slice(0, 10);
}

export interface BranchInput {
  label?: string | null;
  lat: number;
  lng: number;
}

export interface BranchCsvRowResult {
  row: number;
  label: string;
  lat: number;
  lng: number;
}

export interface BranchCsvRowError {
  row: number;
  message: string;
}

export interface BranchCsvResolveResult {
  resolved: BranchCsvRowResult[];
  errors: BranchCsvRowError[];
}

// Every branch's location goes through the same resolveLatLngFromCsvRow
// used for a single pasted link, just once per CSV row — no separate
// "trust this coordinate" path, so a bulk upload can't produce a pin that
// a manual paste wouldn't have. Rows are "label, lat, long" (or
// "label, <Google Maps link>"): the first cell is always the label, the
// rest is handed to the same location resolver as a manual entry.
export async function resolveBranchesCsv(csvText: string): Promise<BranchCsvResolveResult> {
  const rows = parseCsv(csvText);
  const resolved: BranchCsvRowResult[] = [];
  const errors: BranchCsvRowError[] = [];

  for (const [idx, cells] of rows.entries()) {
    const rowNumber = idx + 1;
    const trimmedCells = cells.map((c) => c.trim()).filter(Boolean);
    if (trimmedCells.length === 0) continue;

    // A header row ("label,lat,long" / "label,location" / ...) has no
    // digits in any cell; skip it rather than reporting it as unresolvable.
    if (rowNumber === 1 && trimmedCells.every((c) => !/\d/.test(c))) continue;

    const [label, ...rest] = trimmedCells;
    if (!label || rest.length === 0) {
      errors.push({ row: rowNumber, message: "Expected a label followed by a location (label, lat, long)" });
      continue;
    }

    const coords = await resolveLatLngFromCsvRow(rest);
    if (coords) {
      resolved.push({ row: rowNumber, label, ...coords });
    } else {
      errors.push({ row: rowNumber, message: `Couldn't find a location for "${label}"` });
    }
  }

  return { resolved, errors };
}

export async function listAllBranches() {
  const branches = await prisma.branch.findMany({
    where: { offer: { active: true } },
    include: { offer: { select: { id: true, title: true, vendorName: true, tier: true, tags: true } } },
    orderBy: { createdAt: "asc" },
  });

  return branches.map((b) => ({
    id: b.id,
    label: b.label,
    lat: b.lat,
    lng: b.lng,
    offerId: b.offer.id,
    offerTitle: b.offer.title,
    vendorName: b.offer.vendorName,
    tier: b.offer.tier,
    tags: b.offer.tags,
  }));
}

export async function listActiveOffers() {
  return prisma.offer.findMany({
    where: { active: true },
    select: publicOfferSelect,
    // VendorTier is declared SILVER, GOLD, DIAMOND, so descending puts
    // Diamond first, then Gold, then Silver. Within a tier, admin-defined
    // sortOrder wins (the drag-to-reorder feature), newest as a tiebreaker.
    orderBy: [{ tier: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

export async function getActiveOfferById(id: string) {
  const offer = await prisma.offer.findFirst({
    where: { id, active: true },
    select: publicOfferSelect,
  });
  if (!offer) {
    throw new ApiError(404, "NOT_FOUND", "Offer not found");
  }
  return offer;
}

export async function adminListOffers() {
  return prisma.offer.findMany({
    include: {
      _count: { select: { activations: true } },
      branches: true,
    },
    orderBy: { createdAt: "desc" },
  });
}

function validateRedemptionInput(
  redemptionType: RedemptionType | undefined,
  promoCode: string | undefined | null
) {
  if (redemptionType === "PROMO" && !promoCode) {
    throw new ApiError(
      400,
      "PROMO_CODE_REQUIRED",
      "A promo code is required when the redemption type is Promo code"
    );
  }
}

async function nextSortOrderForTier(tier: VendorTier): Promise<number> {
  const result = await prisma.offer.aggregate({
    where: { tier },
    _max: { sortOrder: true },
  });
  return (result._max.sortOrder ?? -1) + 1;
}

export async function adminCreateOffer(input: {
  title: string;
  description: string;
  vendorName: string;
  tier?: VendorTier;
  discountPercent?: number;
  imageUrl?: string;
  active?: boolean;
  redemptionType?: RedemptionType;
  promoCode?: string;
  tags?: string[];
  branches?: BranchInput[];
}) {
  const redemptionType = input.redemptionType ?? "CARD";
  validateRedemptionInput(redemptionType, input.promoCode);
  const tier = input.tier ?? "GOLD";

  return prisma.offer.create({
    data: {
      title: input.title,
      description: input.description,
      vendorName: input.vendorName,
      tier,
      sortOrder: await nextSortOrderForTier(tier),
      discountPercent: input.discountPercent ?? null,
      imageUrl: input.imageUrl,
      active: input.active ?? true,
      redemptionType,
      promoCode: redemptionType === "PROMO" ? input.promoCode : null,
      tags: sanitizeTags(input.tags) ?? [],
      ...(input.branches ? { branches: { create: input.branches } } : {}),
    },
    include: { branches: true },
  });
}

export async function adminUpdateOffer(
  id: string,
  input: {
    title?: string;
    description?: string;
    vendorName?: string;
    tier?: VendorTier;
    discountPercent?: number | null;
    imageUrl?: string;
    active?: boolean;
    redemptionType?: RedemptionType;
    promoCode?: string;
    tags?: string[];
    branches?: BranchInput[];
  }
) {
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) {
    throw new ApiError(404, "NOT_FOUND", "Offer not found");
  }

  const resultingType = input.redemptionType ?? offer.redemptionType;
  const resultingPromoCode = input.promoCode ?? offer.promoCode;
  validateRedemptionInput(resultingType, resultingPromoCode);

  const { tags, branches, ...rest } = input;
  const sanitizedTags = sanitizeTags(tags);
  const tierChanged = input.tier !== undefined && input.tier !== offer.tier;

  return prisma.offer.update({
    where: { id },
    data: {
      ...rest,
      promoCode: resultingType === "PROMO" ? resultingPromoCode : null,
      redemptionType: resultingType,
      ...(sanitizedTags !== undefined ? { tags: sanitizedTags } : {}),
      // Moving to a different tier drops the offer to the end of its new
      // tier's order rather than keeping an arbitrary old position.
      ...(tierChanged ? { sortOrder: await nextSortOrderForTier(input.tier!) } : {}),
      // Branches are small, admin-managed lists: replace-all is simpler and
      // just as correct as diffing for this scale.
      ...(branches !== undefined ? { branches: { deleteMany: {}, create: branches } } : {}),
    },
    include: { branches: true },
  });
}

export const BULK_IMPORT_COLUMNS = [
  "title",
  "description",
  "vendorName",
  "tier",
  "discountPercent",
  "tags",
  "imageUrl",
  "redemptionType",
  "promoCode",
  "active",
] as const;

export interface BulkImportRowError {
  row: number;
  message: string;
}

export interface BulkImportResult {
  created: number;
  errors: BulkImportRowError[];
}

export async function adminBulkImportOffers(csvText: string): Promise<BulkImportResult> {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    throw new ApiError(400, "EMPTY_CSV", "The CSV file is empty");
  }

  const firstCell = (rows[0]?.[0] ?? "").trim().toLowerCase();
  const hasHeader = firstCell === "title";
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const errors: BulkImportRowError[] = [];
  const toCreate: Prisma.OfferCreateManyInput[] = [];
  const nextSortOrderByTier: Partial<Record<VendorTier, number>> = {};

  for (const [idx, cols] of dataRows.entries()) {
    const rowNumber = idx + (hasHeader ? 2 : 1);
    const [
      title,
      description,
      vendorName,
      tierRaw,
      discountPercentRaw,
      tagsRaw,
      imageUrlRaw,
      redemptionTypeRaw,
      promoCodeRaw,
      activeRaw,
    ] = cols;

    if (!title?.trim()) {
      errors.push({ row: rowNumber, message: "Title is required" });
      continue;
    }
    if (!description?.trim()) {
      errors.push({ row: rowNumber, message: "Description is required" });
      continue;
    }
    if (!vendorName?.trim()) {
      errors.push({ row: rowNumber, message: "Vendor is required" });
      continue;
    }

    const tier = (tierRaw?.trim() || "GOLD").toUpperCase();
    if (tier !== "SILVER" && tier !== "GOLD" && tier !== "DIAMOND") {
      errors.push({ row: rowNumber, message: `Tier must be SILVER, GOLD, or DIAMOND (got "${tierRaw}")` });
      continue;
    }

    let discountPercent: number | null = null;
    const discountPercentStr = discountPercentRaw?.trim();
    if (discountPercentStr) {
      const parsed = Number(discountPercentStr);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) {
        errors.push({
          row: rowNumber,
          message: `Discount % must be a whole number between 1 and 100 (got "${discountPercentStr}")`,
        });
        continue;
      }
      discountPercent = parsed;
    }

    const redemptionType = (redemptionTypeRaw?.trim() || "CARD").toUpperCase();
    if (redemptionType !== "CARD" && redemptionType !== "PROMO") {
      errors.push({
        row: rowNumber,
        message: `Redemption type must be CARD or PROMO (got "${redemptionTypeRaw}")`,
      });
      continue;
    }

    const promoCode = promoCodeRaw?.trim() || null;
    if (redemptionType === "PROMO" && !promoCode) {
      errors.push({ row: rowNumber, message: "Promo code is required when redemption type is PROMO" });
      continue;
    }

    const imageUrl = imageUrlRaw?.trim() || null;
    if (imageUrl) {
      try {
        new URL(imageUrl);
      } catch {
        errors.push({ row: rowNumber, message: `Image URL is not valid (got "${imageUrl}")` });
        continue;
      }
    }

    const tags =
      sanitizeTags(
        tagsRaw
          ? tagsRaw
              .split(";")
              .map((t) => t.trim())
              .filter(Boolean)
          : []
      ) ?? [];

    const activeStr = activeRaw?.trim().toLowerCase();
    const active = !activeStr || ["true", "1", "yes"].includes(activeStr);

    const vendorTier = tier as VendorTier;
    if (!(vendorTier in nextSortOrderByTier)) {
      nextSortOrderByTier[vendorTier] = await nextSortOrderForTier(vendorTier);
    }
    const sortOrder = nextSortOrderByTier[vendorTier]!;
    nextSortOrderByTier[vendorTier] = sortOrder + 1;

    toCreate.push({
      title: title.trim(),
      description: description.trim(),
      vendorName: vendorName.trim(),
      tier: vendorTier,
      sortOrder,
      discountPercent,
      tags,
      imageUrl,
      redemptionType: redemptionType as RedemptionType,
      promoCode: redemptionType === "PROMO" ? promoCode : null,
      active,
    });
  }

  if (toCreate.length > 0) {
    await prisma.offer.createMany({ data: toCreate });
  }

  return { created: toCreate.length, errors };
}

export async function adminReorderOffers(tier: VendorTier, orderedIds: string[]) {
  const offers = await prisma.offer.findMany({ where: { tier }, select: { id: true } });
  const validIds = new Set(offers.map((o) => o.id));

  if (orderedIds.length !== offers.length || orderedIds.some((id) => !validIds.has(id))) {
    throw new ApiError(
      400,
      "INVALID_REORDER",
      "The list of offers doesn't match this tier's current offers"
    );
  }

  await prisma.$transaction(
    orderedIds.map((id, index) => prisma.offer.update({ where: { id }, data: { sortOrder: index } }))
  );
}

export async function adminDeleteOffer(id: string) {
  const offer = await prisma.offer.findUnique({ where: { id } });
  if (!offer) {
    throw new ApiError(404, "NOT_FOUND", "Offer not found");
  }

  await prisma.offer.delete({ where: { id } });
}
