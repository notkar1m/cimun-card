-- Add new columns to Offer (nullable for now, backfilled below)
ALTER TABLE "Offer" ADD COLUMN "vendorName" TEXT;
ALTER TABLE "Offer" ADD COLUMN "tier" "VendorTier";

-- Backfill from the Vendor table before it's dropped
UPDATE "Offer" o
SET "vendorName" = v."businessName",
    "tier" = v."tier"
FROM "Vendor" v
WHERE v.id = o."vendorId";

-- Now that every row is backfilled, enforce NOT NULL / default
ALTER TABLE "Offer" ALTER COLUMN "vendorName" SET NOT NULL;
ALTER TABLE "Offer" ALTER COLUMN "tier" SET NOT NULL;
ALTER TABLE "Offer" ALTER COLUMN "tier" SET DEFAULT 'GOLD';

-- Drop the old vendor link
ALTER TABLE "Offer" DROP CONSTRAINT "Offer_vendorId_fkey";
DROP INDEX IF EXISTS "Offer_vendorId_idx";
ALTER TABLE "Offer" DROP COLUMN "vendorId";

-- Drop the Vendor table entirely (also drops its FK to Account)
DROP TABLE "Vendor";

-- Vendor accounts are no longer a concept; remove them and the role
DELETE FROM "Account" WHERE "role" = 'VENDOR';

CREATE TYPE "Role_new" AS ENUM ('SUPERADMIN', 'USER');
ALTER TABLE "Account" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
