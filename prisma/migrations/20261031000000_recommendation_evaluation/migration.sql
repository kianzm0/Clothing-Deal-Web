ALTER TABLE "users" ADD COLUMN "evaluationEnabled" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "recommendation_impressions" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "viewId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "resultCount" INTEGER NOT NULL,
  "sort" TEXT NOT NULL,
  "filtered" BOOLEAN NOT NULL,
  "personalized" BOOLEAN NOT NULL,
  "displayedTotal" DOUBLE PRECISION NOT NULL,
  "rankingVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "recommendation_impressions_userId_viewId_productId_key" ON "recommendation_impressions"("userId", "viewId", "productId");
CREATE INDEX "recommendation_impressions_createdAt_idx" ON "recommendation_impressions"("createdAt");
CREATE TABLE "recommendation_outcomes" (
  "impressionId" TEXT NOT NULL REFERENCES "recommendation_impressions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "action" "InteractionAction" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("impressionId", "action")
);
