-- DropTable
DROP TABLE "Attendance";

-- DropTable
DROP TABLE "FoodRedemption";

-- DropTable
DROP TABLE "AppSettings";

-- DropEnum
DROP TYPE "AttendanceMethod";

-- Remove exec accounts (role removed) now that referencing tables are gone
DELETE FROM "Account" WHERE "role" = 'EXEC';

-- AlterTable
ALTER TABLE "Account" DROP COLUMN "qrToken";
ALTER TABLE "Account" DROP COLUMN "foodToken";

-- Recreate Role enum without EXEC
CREATE TYPE "Role_new" AS ENUM ('SUPERADMIN', 'VENDOR', 'USER');
ALTER TABLE "Account" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";
