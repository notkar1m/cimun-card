-- Silver sits between Gold and the bottom: declared before Gold in the enum
-- so "ORDER BY tier DESC" naturally yields Diamond, Gold, Silver.
ALTER TYPE "VendorTier" ADD VALUE 'SILVER' BEFORE 'GOLD';

ALTER TABLE "Offer" ADD COLUMN "sortOrder" INTEGER NOT NULL DEFAULT 0;
