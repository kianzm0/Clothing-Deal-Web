import test from "node:test";
import assert from "node:assert/strict";
import { recommendationOffer, totalPrice } from "./recommendation-offer";
import { DEFAULT_PREFERENCES, Product } from "./types";

const base = (store: string, price: number, shippingCost: number, currency?: string): Product => ({
  id: store, name: store, brand: store, category: "hoodie", colors: [], sizes: ["M"], image: "",
  offers: [{ store, price, originalPrice: price + 20, shippingCost, currency, sizesInStock: ["M"], lastUpdated: "2026-11-04", url: "#" }],
});

test("compares USD retailers using item plus shipping", () => {
  const product = base("GBP", 1, 0, "GBP");
  product.offers.push({ ...product.offers[0], store: "USD", price: 50, shippingCost: 5, currency: "USD" });
  assert.equal(recommendationOffer(product, { ...DEFAULT_PREFERENCES, sizes: ["M"] })?.store, "USD");
  assert.equal(totalPrice(product.offers[1]), 55);
});

test("excludes foreign and missing currencies from recommendations", () => {
  const product = base("GBP", 1, 0, "GBP");
  product.offers.push({ ...product.offers[0], store: "Unknown", price: 2, currency: undefined });
  assert.equal(recommendationOffer(product, DEFAULT_PREFERENCES), undefined);
});
