ALTER TABLE "Account" ADD COLUMN "name" TEXT;

UPDATE "Account" SET "name" = initcap(split_part(email, '@', 1)) WHERE "name" IS NULL;

ALTER TABLE "Account" ALTER COLUMN "name" SET NOT NULL;
