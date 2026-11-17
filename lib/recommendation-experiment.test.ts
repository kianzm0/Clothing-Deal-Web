import { test } from "node:test";
import assert from "node:assert/strict";
import { assignVariant, DEFAULT_EXPERIMENT, compareExperiment, sampleRatioCheck, rankWithPolicy } from "./recommendation-experiment";
import { rankProducts } from "./ranking";
import { PRODUCTS } from "./data";
import { DEFAULT_WEIGHTS } from "./bandit";
import { DEFAULT_PREFERENCES } from "./types";
import { EMPTY_PROFILE } from "./preference-model";
test("disabled experiments stay control; enabled assignment is stable and distributed", () => {
  assert.equal(assignVariant("u"), "control");
  const config = { ...DEFAULT_EXPERIMENT, enabled: true, allocationBps: 5000 };
  const users = Array.from({ length: 10000 }, (_, i) => `user-${i}`);
  const treatment = users.filter(id => assignVariant(id, config) === "bounded-novelty-v1").length;
  assert.ok(treatment > 4500 && treatment < 5500);
  assert.equal(assignVariant("u", config), assignVariant("u", config));
});
test("control preserves ranking and treatment is deterministic without mutating products", () => {
  const args = [PRODUCTS, DEFAULT_PREFERENCES, DEFAULT_WEIGHTS, EMPTY_PROFILE] as const;
  assert.deepEqual(rankWithPolicy(...args, "control", 1000000), rankProducts(...args, 1000000));
  assert.deepEqual(rankWithPolicy(...args, "bounded-novelty-v1", 1000000), rankWithPolicy([...PRODUCTS].reverse(), DEFAULT_PREFERENCES, DEFAULT_WEIGHTS, EMPTY_PROFILE, "bounded-novelty-v1", 1000000));
});
test("uncertainty uses accounts rather than treating repeat impressions as independent", () => {
  const rows = [{ userId: "a", variant: "control" as const, position: 1, save: true, retailerClick: false }, { userId: "b", variant: "control" as const, position: 1, save: false, retailerClick: true }];
  const base = compareExperiment(rows), repeated = compareExperiment([...Array(100).fill(rows[0]), rows[1]]);
  assert.equal(base.save.control.standardError, repeated.save.control.standardError);
  assert.equal(compareExperiment([]).save.difference, null);
  assert.equal(compareExperiment([rows[0]]).save.control.standardError, null);
  assert.equal(sampleRatioCheck(500, 500, 5000).mismatch, false);
  assert.equal(sampleRatioCheck(900, 100, 5000).mismatch, true);
});
