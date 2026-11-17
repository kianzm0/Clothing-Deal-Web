import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { assignVariant, DEFAULT_EXPERIMENT, ExperimentVariant, CONTROL_POLICY_VERSION, TREATMENT_POLICY_VERSION } from "./recommendation-experiment";
type Db = Pick<Prisma.TransactionClient, "recommendationExperiment" | "recommendationAssignment">;
export const noExperiment = { experimentId: null, variant: "control" as ExperimentVariant };
export async function experimentConfig(db: Db) {
  if (process.env.RECOMMENDATION_EXPERIMENTS_ENABLED !== "true") return null;
  const config = await db.recommendationExperiment.findUnique({ where: { id: DEFAULT_EXPERIMENT.id } });
  return config?.enabled && config.allocationBps > 0 && config.allocationBps < 10000 && config.controlPolicyVersion === CONTROL_POLICY_VERSION && config.treatmentPolicyVersion === TREATMENT_POLICY_VERSION ? config : null;
}
export async function accountExperiment(userId: string) {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { evaluationEnabled: true } });
    if (!user?.evaluationEnabled) return noExperiment;
    const config = await experimentConfig(tx);
    if (!config) return noExperiment;
    const row = await tx.recommendationAssignment.upsert({ where: { experimentId_userId: { experimentId: config.id, userId } }, update: {},
      create: { experimentId: config.id, userId, variant: assignVariant(userId, config), allocationBps: config.allocationBps } });
    if (!["control", "bounded-novelty-v1"].includes(row.variant)) return noExperiment;
    return { experimentId: row.experimentId, variant: row.variant as ExperimentVariant };
  });
}
