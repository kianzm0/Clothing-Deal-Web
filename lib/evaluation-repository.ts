import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { Exposure, EvaluationAction, RANKING_VERSION, RETENTION_MS, isAttributable } from "./evaluation";

// Serialize consent changes and writes for an account, including concurrent tabs.
export async function evaluationTransaction<T>(userId: string, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    return work(tx);
  });
}
export async function setEvaluationConsent(userId: string, enabled: boolean) {
  return evaluationTransaction(userId, async tx => {
    await tx.user.update({ where: { id: userId }, data: { evaluationEnabled: enabled } });
    if (!enabled) await tx.recommendationImpression.deleteMany({ where: { userId } });
  });
}
export async function recordExposure(userId: string, exposure: Exposure) {
  return evaluationTransaction(userId, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { evaluationEnabled: true } });
    if (!user?.evaluationEnabled) return { status: 403, error: "Evaluation is disabled." };
    const existing = await tx.recommendationImpression.findUnique({ where: { id: exposure.id } });
    if (existing) {
      if (existing.userId !== userId || Object.entries(exposure).some(([key, value]) => existing[key as keyof typeof existing] !== value)) {
        return { status: 409, error: "Impression ID conflict." };
      }
      return { status: 200, id: existing.id };
    }
    const product = await tx.product.findUnique({ where: { id: exposure.productId }, select: { id: true } });
    if (!product) return { status: 404, error: "Unknown product." };
    // Bound authenticated-client abuse. Duplicate retries do not consume this budget.
    const count = await tx.recommendationImpression.count({ where: { userId, createdAt: { gte: new Date(Date.now() - 3600000) } } });
    if (count >= 1000) return { status: 429, error: "Evaluation event limit reached." };
    const row = await tx.recommendationImpression.upsert({
      where: { userId_viewId_productId: { userId, viewId: exposure.viewId, productId: exposure.productId } },
      update: {}, create: { ...exposure, userId, rankingVersion: RANKING_VERSION },
    });
    return { status: 200, id: row.id };
  });
}
export async function recordEvaluationOutcome(userId: string, impressionId: string, productId: string, action: EvaluationAction) {
  return evaluationTransaction(userId, async tx => {
    const user = await tx.user.findUnique({ where: { id: userId }, select: { evaluationEnabled: true } });
    if (!user?.evaluationEnabled) return { status: 403, error: "Evaluation is disabled." };
    const impression = await tx.recommendationImpression.findUnique({ where: { id: impressionId } });
    const now = new Date();
    if (!impression || !isAttributable(impression, userId, productId, now)) return { status: 404, error: "No eligible impression." };
    await tx.recommendationOutcome.upsert({ where: { impressionId_action: { impressionId, action } },
      update: {}, create: { impressionId, action, createdAt: now } });
    return { status: 200 };
  });
}
export async function purgeEvaluationHistory(now = new Date()) {
  return prisma.recommendationImpression.deleteMany({ where: { createdAt: { lt: new Date(now.getTime() - RETENTION_MS) } } });
}
