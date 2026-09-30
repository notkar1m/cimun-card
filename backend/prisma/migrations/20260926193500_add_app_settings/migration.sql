-- CreateTable: a singleton row of app-wide feature toggles (Map tab,
-- Cimun Card Wrapped). The one row is created lazily on first read/write
-- with default values, so no seed insert is needed here.
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL DEFAULT 'global',
    "mapTabEnabled" BOOLEAN NOT NULL DEFAULT true,
    "wrappedEnabled" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);
