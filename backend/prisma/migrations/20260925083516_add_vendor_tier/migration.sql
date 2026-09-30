-- CreateEnum
CREATE TYPE "VendorTier" AS ENUM ('GOLD', 'DIAMOND');

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "tier" "VendorTier" NOT NULL DEFAULT 'GOLD';
