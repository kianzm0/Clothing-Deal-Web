import { Prisma } from "@prisma/client";
import { CATALOG_PAGE_SIZE, CatalogQuery } from "./catalog-query";
import { prisma } from "./prisma";
import { Category, Offer, Product } from "./types";
import { CatalogAttributes } from "./catalog-options";

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
      .filter((o: any) => o.status !== "needs_review" && o.currency === "USD")
      .map((o: any): Offer => ({
        store: o.store,
        price: Number(o.price),
        originalPrice: Number(o.originalPrice),
        shippingCost: Number(o.shippingCost),
        currency: o.currency,
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
  const rows = await prisma.product.findMany({ take: 100, orderBy: { id: "asc" }, include: { offers: true } });
  return rows.map(toProduct).filter((product) => product.offers.length > 0);
}

export async function getCatalogAttributes(): Promise<CatalogAttributes> {
  const rows = await prisma.$queryRaw<{ kind: string; value: string }[]>`
    WITH visible AS (
      SELECT brand, colors, sizes FROM products p WHERE EXISTS
      (SELECT 1 FROM offers o WHERE o."productId" = p.id AND o.status <> 'needs_review' AND o.currency = 'USD')
    )
    (SELECT DISTINCT 'brand' AS kind, brand AS value FROM visible WHERE brand <> '' ORDER BY value LIMIT 1000)
    UNION ALL (SELECT DISTINCT 'color' AS kind, unnest(colors) AS value FROM visible ORDER BY value LIMIT 1000)
    UNION ALL (SELECT DISTINCT 'size' AS kind, unnest(sizes) AS value FROM visible ORDER BY value LIMIT 1000)`;
  const values = (kind: string) => rows.filter(r => r.kind === kind && r.value).map(r => r.value).sort((a,b) => a.localeCompare(b));
  return { brands: values("brand"), colors: values("color"), sizes: values("size") };
}

export async function getCatalogPage(query: CatalogQuery) {
  // Keyset pagination does not need a cursor row to still exist. All values are parameters.
  const ids = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
    SELECT p.id FROM products p WHERE p.id > ${query.after ?? ""}
    ${query.brand ? Prisma.sql`AND p.brand = ${query.brand}` : Prisma.empty}
    ${query.category ? Prisma.sql`AND p.category::text = ${query.category}` : Prisma.empty}
    AND EXISTS (SELECT 1 FROM offers o WHERE o."productId" = p.id
      AND o.currency = 'USD' AND o.status <> 'needs_review'
      AND o.availability !~* 'out.?of.?stock|sold.?out|discontinued'
      AND o.price >= 0 AND o."shippingCost" >= 0
      AND o.price + o."shippingCost" <= ${query.maxPrice}
      AND CASE WHEN o."originalPrice" > 0 THEN round(100 * (o."originalPrice" - o.price) / o."originalPrice") ELSE 0 END >= ${query.minDiscount})
    ORDER BY p.id LIMIT ${CATALOG_PAGE_SIZE + 1}`);
  const visible = ids.slice(0, CATALOG_PAGE_SIZE);
  const products = await getProductsByIds(visible.map(r => r.id));
  const byId = new Map(products.map(p => [p.id, p]));
  return { products: visible.flatMap(r => byId.has(r.id) ? [byId.get(r.id)!] : []),
    nextCursor: ids.length > CATALOG_PAGE_SIZE ? visible[visible.length - 1].id : null };
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const row = await prisma.product.findUnique({ where: { id }, include: { offers: true } });
  if (!row) return undefined;
  const product = toProduct(row);
  return product.offers.length > 0 ? product : undefined;
}

// Bulk lookup for the preference model, which needs the products
// behind a user's interaction history. Same visibility rules as
// getProductById: a product with no live offer is skipped, since its
// price band can't be computed.
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({ where: { id: { in: ids } }, include: { offers: true } });
  return rows.map(toProduct).filter((product) => product.offers.length > 0);
}

