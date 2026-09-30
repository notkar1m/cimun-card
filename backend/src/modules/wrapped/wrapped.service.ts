import { prisma } from "../../lib/prisma";

export interface WrappedStats {
  totalRedeemed: number;
  topVendor: { name: string; count: number } | null;
  tierBreakdown: { tier: "DIAMOND" | "GOLD" | "SILVER"; count: number }[];
  topTag: { tag: string; count: number } | null;
  firstRedeemedAt: string | null;
}

// Every activation in this app is created already-redeemed (delegates
// self-serve, there's no separate "claim then redeem" step), so
// "redeemed" and "activated" are the same count — no need to track both.
export async function getWrappedStats(userId: string): Promise<WrappedStats> {
  const activations = await prisma.activation.findMany({
    where: { userId, status: "REDEEMED" },
    include: { offer: { select: { vendorName: true, tier: true, tags: true } } },
    orderBy: { redeemedAt: "asc" },
  });

  const vendorCounts = new Map<string, number>();
  const tierCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();

  for (const a of activations) {
    vendorCounts.set(a.offer.vendorName, (vendorCounts.get(a.offer.vendorName) ?? 0) + 1);
    tierCounts.set(a.offer.tier, (tierCounts.get(a.offer.tier) ?? 0) + 1);
    for (const tag of a.offer.tags) {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
  }

  const topVendorEntry = [...vendorCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topTagEntry = [...tagCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  const TIER_ORDER = ["DIAMOND", "GOLD", "SILVER"] as const;

  return {
    totalRedeemed: activations.length,
    topVendor: topVendorEntry ? { name: topVendorEntry[0], count: topVendorEntry[1] } : null,
    topTag: topTagEntry ? { tag: topTagEntry[0], count: topTagEntry[1] } : null,
    tierBreakdown: TIER_ORDER.filter((tier) => tierCounts.has(tier)).map((tier) => ({
      tier,
      count: tierCounts.get(tier)!,
    })),
    firstRedeemedAt: activations[0]?.redeemedAt?.toISOString() ?? null,
  };
}
