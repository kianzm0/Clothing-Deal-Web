-- Schema on main before editorial authorization. Existing databases must baseline
-- this migration (after verifying their schema), not run it over existing tables.
CREATE TYPE "Category" AS ENUM ('t-shirt', 'hoodie', 'sweatshirt', 'long-sleeve');
CREATE TYPE "InteractionAction" AS ENUM ('SAVE', 'UNSAVE', 'SKIP', 'CLICK_OUT');

CREATE TABLE "interactions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "action" "InteractionAction" NOT NULL,
    "reward" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "interactions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "bandit_weights" (
    "userId" TEXT NOT NULL,
    "weights" DOUBLE PRECISION[],
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bandit_weights_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "watchlist_items" (
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "watchlist_items_pkey" PRIMARY KEY ("userId", "productId")
);

CREATE TABLE "preferences" (
    "userId" TEXT NOT NULL,
    "sizes" TEXT[],
    "favoriteBrands" TEXT[],
    "dislikedBrands" TEXT[],
    "colors" TEXT[],
    "fits" TEXT[],
    "maxBudget" DOUBLE PRECISION NOT NULL DEFAULT 200,
    "minDiscountPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "preferences_pkey" PRIMARY KEY ("userId")
);

CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "colors" TEXT[],
    "sizes" TEXT[],
    "image" TEXT NOT NULL,
    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "offers" (
    "id" TEXT NOT NULL,
    "store" TEXT NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "originalPrice" DOUBLE PRECISION NOT NULL,
    "shippingCost" DOUBLE PRECISION NOT NULL,
    "sizesInStock" TEXT[],
    "lastUpdated" TIMESTAMP(3) NOT NULL,
    "url" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "retailerDomain" TEXT,
    "availability" TEXT NOT NULL DEFAULT 'unknown',
    "status" TEXT NOT NULL DEFAULT 'active',
    "confidence" DOUBLE PRECISION,
    "extractionSources" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastScannedAt" TIMESTAMP(3),
    CONSTRAINT "offers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "interactions_userId_idx" ON "interactions"("userId");
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE INDEX "offers_productId_idx" ON "offers"("productId");
ALTER TABLE "interactions" ADD CONSTRAINT "interactions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bandit_weights" ADD CONSTRAINT "bandit_weights_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "watchlist_items" ADD CONSTRAINT "watchlist_items_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "preferences" ADD CONSTRAINT "preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "offers" ADD CONSTRAINT "offers_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
