-- Accounts can now hold more than one role (an admin who is also a
-- delegate), and a single "owner" admin who can manage other admins.

-- AlterTable: add the new columns alongside the old "role" column first,
-- so we can backfill from it before dropping it.
ALTER TABLE "Account" ADD COLUMN "roles" "Role"[] NOT NULL DEFAULT '{}';
ALTER TABLE "Account" ADD COLUMN "isOwner" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: every existing account keeps exactly the one role it had.
UPDATE "Account" SET "roles" = ARRAY["role"]::"Role"[];

-- Grandfather every pre-existing admin as an owner, so nobody who already
-- had full access loses the ability to manage other admins.
UPDATE "Account" SET "isOwner" = true WHERE "role" = 'SUPERADMIN';

-- Drop the old single-role column and its index.
DROP INDEX IF EXISTS "Account_role_idx";
ALTER TABLE "Account" DROP COLUMN "role";
