-- Delegates can now sign up with a name + 4-digit ID instead of an email.
-- Email becomes optional (admins still always have one); loginId is the
-- new optional, unique identifier delegates log in with.

-- AlterTable: email is no longer required
ALTER TABLE "Account" ALTER COLUMN "email" DROP NOT NULL;

-- AlterTable: add the new login identifier
ALTER TABLE "Account" ADD COLUMN "loginId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Account_loginId_key" ON "Account"("loginId");
