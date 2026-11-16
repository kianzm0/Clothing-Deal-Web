import test from "node:test";
import assert from "node:assert/strict";
import { clampRefreshLimit, MAX_REFRESH_CONCURRENCY, MAX_REFRESH_LIMIT, REFRESH_AFTER_MS, REVIEW_AFTER_MS } from "./offer-refresh";

test("clamps scheduled batches to a safe bounded range", () => {
  assert.equal(clampRefreshLimit(undefined), 10);
  assert.equal(clampRefreshLimit("0"), 10);
  assert.equal(clampRefreshLimit("not-a-number"), 10);
  assert.equal(clampRefreshLimit(String(MAX_REFRESH_LIMIT + 1)), MAX_REFRESH_LIMIT);
});

test("keeps the refresh policy conservative", () => {
  assert.equal(MAX_REFRESH_CONCURRENCY, 2);
  assert.equal(REFRESH_AFTER_MS, 6 * 60 * 60 * 1000);
  assert.equal(REVIEW_AFTER_MS, 24 * 60 * 60 * 1000);
});