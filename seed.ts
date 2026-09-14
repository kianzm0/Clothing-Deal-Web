import { PrismaClient } from "@prisma/client";
import { PRODUCTS } from "../lib/data";

const prisma = new PrismaClient();

// Maps our hyphenated Category strings ("t-shirt") to the Prisma
// enum members (T_SHIRT) — keeps lib/data.ts and the frontend
// untouched while the DB uses proper enum values.
const CATEGORY_MAP: Record<string, "T_SHIRT" | "HOODIE" | "SWEATSHIRT" | "LONG_SLEEVE"> = {
  "t-shirt": "T_SHIRT",
  hoodie: "HOODIE",
  sweatshirt: "SWEATSHIRT",
  "long-sleeve": "LONG_SLEEVE",
};

async function main() {
  console.log(`Seeding ${PRODUCTS.length} products...`);

  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        name: p.name,
        brand: p.brand,
        category: CATEGORY_MAP[p.category],
        colors: p.colors,
        sizes: p.sizes,
        image: p.image,
        offers: {
          create: p.offers.map((o) => ({
            store: o.store,
            price: o.price,
            originalPrice: o.originalPrice,
            shippingCost: o.shippingCost,
            sizesInStock: o.sizesInStock,
            lastUpdated: new Date(o.lastUpdated),
            url: o.url,
          })),
        },
      },
    });
  }

  console.log("Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
