import { prisma } from "./prisma";
import { Category, Offer, Product } from "./types";

// This is the file that changed for Phase 3. Pages still call only
// getAllProducts() / getProductById() — nothing in app/ or
// components/ knows the data now comes from Postgres instead of
// the seeded array in lib/data.ts.

const CATEGORY_MAP: Record<string, Category> = {
  T_SHIRT: "t-shirt",
  HOODIE: "hoodie",
  SWEATSHIRT: "sweatshirt",
  LONG_SLEEVE: "long-sleeve",
};

// Prisma's generated types would normally be imported here, but we
// keep the function signatures typed against our own Product/Offer
// so the rest of the app never has to import anything Prisma-specific.
function toProduct(row: any): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    category: CATEGORY_MAP[row.category],
    colors: row.colors,
    sizes: row.sizes,
    image: row.image,
    // Scavenged offers below the review threshold are excluded here
    // rather than in the UI, so nothing downstream has to know a
    // "needs_review" state exists — see lib/scavenger.ts.
    offers: row.offers
      .filter((o: any) => o.status !== "needs_review")
      .map((o: any): Offer => ({
        store: o.store,
        price: o.price,
        originalPrice: o.originalPrice,
        shippingCost: o.shippingCost,
        sizesInStock: o.sizesInStock,
        lastUpdated: o.lastUpdated.toISOString(),
        url: o.url,
        sourceUrl: o.sourceUrl ?? undefined,
        retailerDomain: o.retailerDomain ?? undefined,
        availability: o.availability ?? undefined,
        status: o.status ?? undefined,
        confidence: o.confidence ?? undefined,
        extractionSources: o.extractionSources ?? undefined,
        lastScannedAt: o.lastScannedAt?.toISOString(),
      })),
  };
}

export async function getAllProducts(): Promise<Product[]> {
  const rows = await prisma.product.findMany({ include: { offers: true } });
  return rows.map(toProduct).filter((product) => product.offers.length > 0);
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { id }, include: { offers: true } });
  if (!row) return undefined;
  const product = toProduct(row);
  return product.offers.length > 0 ? product : undefined;
}
