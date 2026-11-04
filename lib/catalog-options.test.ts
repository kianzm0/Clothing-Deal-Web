import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { getCatalogAttributes } from "./repository";
import { catalogAttributesFromProducts, mergeSavedOptions } from "./catalog-options";
import type { Product } from "./types";

const restorations: Array<() => void> = [];
function stub(target: object, key: string, implementation: (...args: any[]) => any) {
  const object = target as Record<string, (...args: any[]) => any>;
  const original = object[key];
  const spy = mock.fn(implementation);
  object[key] = spy;
  restorations.push(() => { object[key] = original; });
  return spy;
}

const offer = (status = "active") => ({
  store: "Retailer", price: 20, originalPrice: 30, shippingCost: 0,
  currency: "USD", sizesInStock: ["M"], lastUpdated: new Date("2026-10-30"),
  currency: "USD", url: "https://example.test/item", status,
});
const row = (id: string, brand: string, colors: string[], sizes: string[], status = "active") => ({
  id, name: id, brand, category: "T_SHIRT", colors, sizes, image: "",
  offers: [offer(status)],
});

beforeEach(() => {
  stub(prisma.product, "findMany", async () => []);
});
afterEach(() => {
  while (restorations.length) restorations.pop()!();
});

test("attributes come from the current visible catalog, including newly published values", async () => {
  const read = stub(prisma.product, "findMany", async () => [
    row("old", "Everlane", ["black"], ["M"]),
    row("new", "New Brand", ["cobalt"], ["XXL"]),
  ]);
  assert.deepEqual(await getCatalogAttributes(), {
    brands: ["Everlane", "New Brand"],
    colors: ["black", "cobalt"],
    sizes: ["M", "XXL"],
  });
  assert.equal(read.mock.callCount(), 1);
});

test("catalog refresh reflects removals while saved values remain selectable", () => {
  const products = [
    { id: "p", name: "Tee", brand: "Current", category: "t-shirt", colors: ["red"], sizes: ["S"], image: "", offers: [] },
  ] as Product[];
  const saved = { brands: ["Removed Brand"], colors: ["blue"], sizes: ["XL"] };
  const current = catalogAttributesFromProducts(products);
  assert.deepEqual(current, { brands: ["Current"], colors: ["red"], sizes: ["S"] });
  assert.deepEqual(mergeSavedOptions(current.brands, saved.brands), ["Current", "Removed Brand"]);
  assert.deepEqual(mergeSavedOptions(current.colors, saved.colors), ["blue", "red"]);
  assert.deepEqual(mergeSavedOptions(current.sizes, saved.sizes), ["S", "XL"]);
});

test("empty and review-only catalogs produce empty option lists", async () => {
  const read = stub(prisma.product, "findMany", async () => [row("held", "Held Brand", ["green"], ["L"], "needs_review")]);
  assert.deepEqual(await getCatalogAttributes(), { brands: [], colors: [], sizes: [] });
  assert.equal(read.mock.callCount(), 1);
});
