-- The email-based forgot-password flow is gone (no SMTP in use anymore —
-- every account logs in with a 4-digit ID except the single email-based
-- superadmin, who changes their password in-app instead). Drop the now-
-- unused reset-token columns.

ALTER TABLE "Account" DROP COLUMN "resetTokenHash";
ALTER TABLE "Account" DROP COLUMN "resetTokenExpiresAt";
