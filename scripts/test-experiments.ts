import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { accountExperiment } from "../lib/experiment-repository";
import { recordExposure, setEvaluationConsent } from "../lib/evaluation-repository";
import { EXPERIMENT_ID } from "../lib/recommendation-experiment";
async function main() {
  if (process.env.EXPERIMENT_TEST_DATABASE !== "1") throw new Error("Requires disposable database");
  const id = `experiment-${crypto.randomUUID()}`;
  await prisma.user.create({ data: { id, email: `${id}@example.test`, passwordHash: "test" } });
  await prisma.product.create({ data: { id, name: "Test", brand: "Test", category: "T_SHIRT", colors: [], sizes: [], image: "" } });
  const exposure = { id: crypto.randomUUID(), viewId: crypto.randomUUID(), productId: id, position: 1, resultCount: 1, sort: "best-match" as const, personalized: true, filtered: false, displayedTotal: 20 };
  try {
    process.env.RECOMMENDATION_EXPERIMENTS_ENABLED = "true";
    assert.equal((await accountExperiment(id)).experimentId, null);
    await setEvaluationConsent(id, true);
    assert.equal((await accountExperiment(id)).experimentId, null);
    await prisma.recommendationExperiment.update({ where: { id: EXPERIMENT_ID }, data: { enabled: true, allocationBps: 5000 } });
    const assignments = await Promise.all(Array.from({ length: 5 }, () => accountExperiment(id)));
    assert.ok(assignments.every(a => a.variant === assignments[0].variant));
    assert.equal(await prisma.recommendationAssignment.count({ where: { userId: id } }), 1);
    const arm = assignments[0];
    const claim = { ...exposure, experimentId: EXPERIMENT_ID, experimentVariant: arm.variant };
    assert.equal((await recordExposure(id, { ...claim, experimentVariant: arm.variant === "control" ? "bounded-novelty-v1" : "control" })).status, 409);
    assert.equal((await recordExposure(id, claim)).status, 200);
    assert.equal((await recordExposure(id, claim)).status, 200);
    assert.equal((await recordExposure(id, exposure)).status, 409);
    assert.equal((await recordExposure(id, { ...claim, id: crypto.randomUUID(), sort: "lowest-price" })).status, 409);
    await prisma.recommendationExperiment.update({ where: { id: EXPERIMENT_ID }, data: { enabled: false } });
    assert.equal((await accountExperiment(id)).experimentId, null);
    assert.equal((await recordExposure(id, { ...claim, id: crypto.randomUUID(), viewId: crypto.randomUUID() })).status, 409);
    // Historical retries remain valid after disabling the experiment.
    assert.equal((await recordExposure(id, claim)).status, 200);
    await setEvaluationConsent(id, false);
    assert.equal(await prisma.recommendationAssignment.count({ where: { userId: id } }), 0);
    assert.equal(await prisma.recommendationImpression.count({ where: { userId: id } }), 0);
  } finally {
    await prisma.recommendationExperiment.update({ where: { id: EXPERIMENT_ID }, data: { enabled: false, allocationBps: 0 } });
    await prisma.user.deleteMany({ where: { id } }); await prisma.product.deleteMany({ where: { id } });
    delete process.env.RECOMMENDATION_EXPERIMENTS_ENABLED;
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
