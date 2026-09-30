-- AlterTable
ALTER TABLE "Account" ADD COLUMN     "foodToken" TEXT;

-- CreateTable
CREATE TABLE "FoodRedemption" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "redeemedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "redeemedById" TEXT NOT NULL,

    CONSTRAINT "FoodRedemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AppSettings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "currentFoodRound" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "AppSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Account_foodToken_key" ON "Account"("foodToken");

-- CreateIndex
CREATE INDEX "FoodRedemption_round_idx" ON "FoodRedemption"("round");

-- CreateIndex
CREATE UNIQUE INDEX "FoodRedemption_userId_round_key" ON "FoodRedemption"("userId", "round");

-- AddForeignKey
ALTER TABLE "FoodRedemption" ADD CONSTRAINT "FoodRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodRedemption" ADD CONSTRAINT "FoodRedemption_redeemedById_fkey" FOREIGN KEY ("redeemedById") REFERENCES "Account"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed the singleton settings row
INSERT INTO "AppSettings" ("id", "currentFoodRound") VALUES (1, 1) ON CONFLICT ("id") DO NOTHING;
