CREATE TABLE "recommendation_experiments" (
  "id" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "allocationBps" INTEGER NOT NULL DEFAULT 0,
  "controlPolicyVersion" TEXT NOT NULL,
  "treatmentPolicyVersion" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_experiments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "recommendation_assignments" (
  "experimentId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "variant" TEXT NOT NULL,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "recommendation_assignments_pkey" PRIMARY KEY ("experimentId","userId")
);

ALTER TABLE "recommendation_assignments" ADD CONSTRAINT "recommendation_assignments_experimentId_fkey"
  FOREIGN KEY ("experimentId") REFERENCES "recommendation_experiments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_assignments" ADD CONSTRAINT "recommendation_assignments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "recommendation_assignments" ADD CONSTRAINT "recommendation_assignments_variant_check"
  CHECK ("variant" IN ('control', 'bounded-novelty-v1'));

INSERT INTO "recommendation_experiments" ("id","enabled","allocationBps","controlPolicyVersion","treatmentPolicyVersion")
VALUES ('recommendation-policy-v1', false, 0, 'personalized-v2', 'personalized-v2-bounded-novelty');
