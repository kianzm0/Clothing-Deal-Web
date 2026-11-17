import assert from "node:assert/strict";
import { prisma } from "../lib/prisma";
import { getCatalogPage, getCatalogAttributes } from "../lib/repository";
async function main() {
  if (process.env.CATALOG_TEST_DATABASE !== "1") throw new Error("Requires disposable database");
  const prefix = `pagination-${crypto.randomUUID()}`;
  try {
    for (let i = 0; i < 103; i++) await prisma.product.create({ data: { id: `${prefix}-${String(i).padStart(3,"0")}`, name: "Test", brand: prefix, category: "T_SHIRT", colors: ["cobalt"], sizes: ["M"], image: "", offers: { create: { store: "Test", price: 20, originalPrice: 40, shippingCost: 5, lastUpdated: new Date(), url: "https://example.test", sizesInStock: [], status: i === 102 ? "needs_review" : "active" } } } });
    const query = { brand: prefix, category: "t-shirt" as const, maxPrice: 25, minDiscount: 50 };
    const ids: string[] = [];
    let after: string | undefined;
    do {
      const page = await getCatalogPage({ ...query, after });
      assert.ok(page.products.length <= 48);
      ids.push(...page.products.map(p => p.id));
      after = page.nextCursor ?? undefined;
    } while (after);
    assert.equal(ids.length, 102); assert.equal(new Set(ids).size, 102);
    assert.equal((await getCatalogPage({ ...query, maxPrice: 24 })).products.length, 0);
    assert.equal((await getCatalogPage({ ...query, brand: "' OR 1=1 --" })).products.length, 0);
    await prisma.product.delete({ where: { id: ids[47] } });
    assert.equal((await getCatalogPage({ ...query, after: ids[47] })).products[0].id, ids[48]);
    assert.ok((await getCatalogAttributes()).brands.includes(prefix));
    console.log("Verified 103-product pagination, exact shipping filters, deleted cursors and parameter isolation.");
  } finally { await prisma.product.deleteMany({ where: { brand: prefix } }); }
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
