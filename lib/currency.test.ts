import test from "node:test";
import assert from "node:assert/strict";
import { formatCurrency, isSupportedCurrency, normalizeCurrency } from "./currency";

test("normalizes only explicit three-letter currency values", () => {
  assert.equal(normalizeCurrency("usd"), "USD");
  assert.equal(normalizeCurrency(" GBP "), "GBP");
  assert.equal(normalizeCurrency(undefined), null);
  assert.equal(normalizeCurrency("US"), null);
});

test("accepts only USD for live comparisons", () => {
  assert.equal(isSupportedCurrency("USD"), true);
  assert.equal(isSupportedCurrency("EUR"), false);
  assert.equal(isSupportedCurrency(undefined), false);
  assert.equal(formatCurrency(79.99, "USD"), "$79.99");
  assert.equal(formatCurrency(79.99, "GBP"), "Currency unavailable");
});
