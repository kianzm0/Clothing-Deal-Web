import test from "node:test";
import assert from "node:assert/strict";
import { assignVariant, compareExperiment, CONTROL_VARIANT, TREATMENT_VARIANT } from "./recommendation-experiment";

test("assignment is stable and bounded by config", () => {
  const config = { id: "test", enabled: true, allocationBps: 5000, controlPolicyVersion: "c", treatmentPolicyVersion: "t" };
  assert.equal(assignVariant("user-123", config), assignVariant("user-123", config));
  for (let i = 0; i < 100; i++) assert.ok([CONTROL_VARIANT, TREATMENT_VARIANT].includes(assignVariant(`user-${i}`, config)));
  assert.equal(assignVariant("user-123", { ...config, enabled: false }), CONTROL_VARIANT);
});

test("experiment comparison clusters repeated observations by account and reports uncertainty", () => {
  const rows = [
    { userId: "a", variant: CONTROL_VARIANT, position: 1, save: false, retailerClick: false },
    { userId: "a", variant: CONTROL_VARIANT, position: 2, save: true, retailerClick: false },
    { userId: "b", variant: CONTROL_VARIANT, position: 1, save: false, retailerClick: false },
    { userId: "c", variant: TREATMENT_VARIANT, position: 1, save: true, retailerClick: true },
    { userId: "d", variant: TREATMENT_VARIANT, position: 2, save: false, retailerClick: false },
  ];
  const result = compareExperiment(rows);
  assert.equal(result.control.users, 2);
  assert.equal(result.treatment.users, 2);
  assert.ok(result.standardError !== null);
  assert.equal(result.difference, 0.5);
});
