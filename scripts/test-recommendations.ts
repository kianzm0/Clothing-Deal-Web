import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { trainInteraction } from "../lib/bandit-repository";
import { getProductById } from "../lib/repository";

// Deliberately opt-in: only run against the disposable CI database.
if (process.env.RECOMMENDATION_TEST_DATABASE !== "1") throw new Error("Set RECOMMENDATION_TEST_DATABASE=1 for a disposable test database");

async function main() {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const userId = `recommendation-test-${suffix}`;
  const ids = [`recommendation-a-${suffix}`, `recommendation-b-${suffix}`];
  try {
    await prisma.user.create({ data: { id: userId, email: `${userId}@example.test`, passwordHash: "test-only" } });
    for (const id of ids) await prisma.product.create({ data: {
      id, name: "Test hoodie", brand: "Test", category: "HOODIE", colors: ["black"], sizes: ["M"], image: "",
      offers: { create: { store: "Test", price: 40, originalPrice: 60, shippingCost: 0, sizesInStock: ["M"], lastUpdated: new Date(), url: "https://example.test" } },
    } });
    const a = (await getProductById(ids[0]))!;
    const b = (await getProductById(ids[1]))!;
    await Promise.all([trainInteraction(userId, a, "SAVE"), trainInteraction(userId, a, "SAVE")]);
    assert.equal(await prisma.interaction.count({ where: { userId } }), 1, "concurrent duplicate saves must log only once");
    await Promise.all([trainInteraction(userId, a, "SKIP"), trainInteraction(userId, b, "SAVE")]);
    assert.equal(await prisma.interaction.count({ where: { userId } }), 3, "concurrent distinct feedback must both persist");
    const final = await trainInteraction(userId, b, "SAVE");
    assert.ok(final.profile.dismissed?.includes(a.id));
    assert.ok(final.profile.liked.some(item => item.productId === b.id));
    assert.ok(final.weights.every(Number.isFinite));
    assert.equal(final.duplicate, true);
    console.log("Recommendation database checks passed: concurrent duplicate suppression, distinct updates, and profile state.");
  } finally {
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.product.deleteMany({ where: { id: { in: ids } } });
    await prisma.$disconnect();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
