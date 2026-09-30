-- Branches no longer carry their own label/address: the map labels each
-- pin with the parent offer's vendor name instead.
ALTER TABLE "Branch" DROP COLUMN "label";
ALTER TABLE "Branch" DROP COLUMN "address";
