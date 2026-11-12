import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { assignVariant, DEFAULT_EXPERIMENT, ExperimentConfig, ExperimentVariant } from "./recommendation-experiment";

type Db = Pick<Prisma.TransactionClient, "recommendationExperiment" | "recommendationAssignment">;

export async function getActiveExperiment(db: Db = prisma): Promise<ExperimentConfig> {
  const row = await db.recommendationExperiment.findUnique({ where: { id: DEFAULT_EXPERIMENT.id } });
  if (!row) return DEFAULT_EXPERIMENT;
  return { id: row.id, enabled: row.enabled, allocationBps: row.allocationBps,
    controlPolicyVersion: row.controlPolicyVersion, treatmentPolicyVersion: row.treatmentPolicyVersion };
}

export async function getOrCreateAssignment(userId: string, db: Db = prisma): Promise<{ experimentId: string; variant: ExperimentVariant }> {
  const config = await getActiveExperiment(db);
  if (!config.enabled) return { experimentId: config.id, variant: "control" };
  const existing = await db.recommendationAssignment.findUnique({ where: { experimentId_userId: { experimentId: config.id, userId } } });
  if (existing) return { experimentId: existing.experimentId, variant: existing.variant as ExperimentVariant };
  const variant = assignVariant(userId, config);
  const row = await db.recommendationAssignment.create({ data: { experimentId: config.id, userId, variant } });
  return { experimentId: row.experimentId, variant: row.variant as ExperimentVariant };
}
