import { prisma } from "../../lib/prisma";
import { createRedeemedActivationWithUniqueCode } from "../../lib/codeGenerator";
import { ApiError } from "../../lib/ApiError";

export async function redeemOffer(offerId: string, userId: string) {
  const offer = await prisma.offer.findFirst({ where: { id: offerId, active: true } });
  if (!offer) {
    throw new ApiError(404, "NOT_FOUND", "Offer not found");
  }

  const activation = await createRedeemedActivationWithUniqueCode(offerId, userId);

  return {
    offerTitle: activation.offer.title,
    vendorName: activation.offer.vendorName,
    status: activation.status,
    redeemedAt: activation.redeemedAt,
    redemptionType: activation.offer.redemptionType,
    promoCode: activation.offer.redemptionType === "PROMO" ? activation.offer.promoCode : null,
    userName: activation.offer.redemptionType === "CARD" ? activation.user.name : null,
  };
}

export async function listMyActivations(userId: string) {
  const activations = await prisma.activation.findMany({
    where: { userId },
    include: { offer: true },
    orderBy: { activatedAt: "desc" },
  });

  return activations.map((a) => ({
    id: a.id,
    code: a.code,
    status: a.status,
    offerTitle: a.offer.title,
    vendorName: a.offer.vendorName,
    activatedAt: a.activatedAt,
    redeemedAt: a.redeemedAt,
  }));
}
