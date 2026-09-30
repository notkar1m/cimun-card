-- CreateEnum
CREATE TYPE "RedemptionType" AS ENUM ('CARD', 'PROMO');

-- AlterTable
ALTER TABLE "Offer" ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "redemptionType" "RedemptionType" NOT NULL DEFAULT 'CARD';
