import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { recordExposure, recordEvaluationOutcome, setEvaluationConsent, purgeEvaluationHistory } from "../lib/evaluation-repository";
import { RETENTION_MS } from "../lib/evaluation";

async function main() {
  if (process.env.EVALUATION_TEST_DATABASE !== "1") throw new Error("Use only a disposable test database with EVALUATION_TEST_DATABASE=1");
  const userId = `evaluation-test-${randomUUID()}`, productId = `evaluation-product-${randomUUID()}`;
  await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: "test-only" } });
  await prisma.product.create({ data: { id: productId, name: "Test", brand: "Test", category: "HOODIE", colors: [], sizes: [], image: "" } });
  const exposure = { id: randomUUID(), viewId: randomUUID(), productId, position: 1, resultCount: 2,
    sort: "best-match" as const, filtered: false, personalized: true, displayedTotal: 20 };
  try {
    assert.equal((await recordExposure(userId, exposure)).status, 403);
    await setEvaluationConsent(userId, true);
    const results = await Promise.all(Array.from({ length: 8 }, () => recordExposure(userId, exposure)));
    assert.ok(results.every(r => r.status === 200));
    assert.equal(await prisma.recommendationImpression.count({ where: { userId } }), 1);
    // A fresh event ID cannot duplicate the same product in the same view.
    assert.equal((await recordExposure(userId, { ...exposure, id: randomUUID() })).id, exposure.id);
    await Promise.all(Array.from({ length: 8 }, () => recordEvaluationOutcome(userId, exposure.id, productId, "SAVE")));
    assert.equal(await prisma.recommendationOutcome.count({ where: { impressionId: exposure.id } }), 1);
    // Withdrawal races writes: either order must leave no rows and consent off.
    await Promise.all([recordExposure(userId, { ...exposure, id: randomUUID(), viewId: randomUUID() }), setEvaluationConsent(userId, false)]);
    assert.equal(await prisma.recommendationImpression.count({ where: { userId } }), 0);
    assert.equal(await prisma.recommendationOutcome.count({ where: { impressionId: exposure.id } }), 0);
    await setEvaluationConsent(userId, true);
    await recordExposure(userId, exposure);
    await recordEvaluationOutcome(userId, exposure.id, productId, "CLICK_OUT");
    await prisma.recommendationImpression.update({ where: { id: exposure.id }, data: { createdAt: new Date(Date.now() - RETENTION_MS - 1000) } });
    await purgeEvaluationHistory();
    assert.equal(await prisma.recommendationImpression.count({ where: { userId } }), 0);
    assert.equal(await prisma.recommendationOutcome.count({ where: { impressionId: exposure.id } }), 0);
    await recordExposure(userId, exposure);
    await prisma.user.delete({ where: { id: userId } });
    assert.equal(await prisma.recommendationImpression.count({ where: { userId } }), 0);
    console.log("Evaluation DB checks passed: default-off, concurrent deduplication, attribution, consent race, retention and account deletion cascades.");
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.product.deleteMany({ where: { id: productId } });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
