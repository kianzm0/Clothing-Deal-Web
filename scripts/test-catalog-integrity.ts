import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { addToWatchlist } from "../lib/user-data-repository";
import { getProductById } from "../lib/repository";
async function main() {
  if (process.env.CATALOG_TEST_DATABASE !== "1") throw new Error("Requires disposable database");
  const id = `catalog-test-${crypto.randomUUID()}`;
  const user = await prisma.user.create({ data: { email: `${id}@example.test`, passwordHash: "test" } });
  try {
    await assert.rejects(addToWatchlist(user.id, id), /Product not found/);
    await prisma.product.create({ data: { id, name: "Test", brand: "Test", category: "T_SHIRT", colors: [], sizes: [], image: "", offers: { create: { store: "Test", price: "19.99", originalPrice: "29.99", shippingCost: "0.10", lastUpdated: new Date(), url: "https://example.test", sizesInStock: [] } } } });
    await Promise.all([addToWatchlist(user.id, id), addToWatchlist(user.id, id)]);
    assert.equal(await prisma.watchlistItem.count({ where: { userId: user.id } }), 1);
    const offer = await prisma.offer.findFirstOrThrow({ where: { productId: id } });
    assert.equal(offer.price.plus(offer.shippingCost).toFixed(2), "20.09");
    assert.equal((await getProductById(id))?.offers[0].currency, "USD");
    await prisma.offer.update({ where: { id: offer.id }, data: { currency: null } });
    assert.equal(await getProductById(id), undefined);
    await prisma.product.delete({ where: { id } });
    assert.equal(await prisma.watchlistItem.count({ where: { userId: user.id } }), 0);
  } finally {
    await prisma.product.deleteMany({ where: { id } });
    await prisma.user.delete({ where: { id: user.id } });
  }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
