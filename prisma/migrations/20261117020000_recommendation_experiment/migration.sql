CREATE TABLE recommendation_experiments (
 id TEXT PRIMARY KEY, enabled BOOLEAN NOT NULL DEFAULT false, "allocationBps" INTEGER NOT NULL DEFAULT 0,
 "controlPolicyVersion" TEXT NOT NULL, "treatmentPolicyVersion" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE recommendation_assignments (
 "experimentId" TEXT NOT NULL, "userId" TEXT NOT NULL, variant TEXT NOT NULL, "allocationBps" INTEGER NOT NULL,
 "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT recommendation_assignments_pkey PRIMARY KEY ("experimentId", "userId"),
 CONSTRAINT "recommendation_assignments_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES recommendation_experiments(id) ON DELETE CASCADE ON UPDATE CASCADE,
 CONSTRAINT "recommendation_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE);
CREATE INDEX "recommendation_assignments_userId_idx" ON recommendation_assignments("userId");
ALTER TABLE recommendation_impressions ADD COLUMN "experimentId" TEXT, ADD COLUMN "experimentVariant" TEXT;
CREATE INDEX "recommendation_impressions_experimentId_experimentVariant_idx" ON recommendation_impressions("experimentId", "experimentVariant");
INSERT INTO recommendation_experiments(id, "controlPolicyVersion", "treatmentPolicyVersion") VALUES ('recommendation-policy-v1', 'personalized-v2', 'personalized-v2-bounded-novelty');
