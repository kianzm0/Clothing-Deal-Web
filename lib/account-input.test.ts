import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountInputError, parseSignup, parsePreferences, parseProductId, readAccountJson } from "./account-input";
import { DEFAULT_PREFERENCES } from "./types";
test("registration rejects wrong types, invalid email and bcrypt truncation", () => {
  for (const value of [null, [], { email: 123, password: "password" }, { email: "bad", password: "password" },
    { email: "a@example.test", password: {} }, { email: "a@example.test", password: "a".repeat(73) },
    { email: "a@example.test", password: "😀".repeat(19) }, { email: "a@example.test", password: "password", name: {} }]) assert.throws(() => parseSignup(value), AccountInputError);
  assert.deepEqual(parseSignup({ email: " A@EXAMPLE.test ", password: "a".repeat(72), name: " Name ", role: "ADMIN" }), { email: "a@example.test", password: "a".repeat(72), name: "Name" });
});
test("preferences reject operators, nonfinite/range errors, wrong array elements and excessive lists", () => {
  for (const patch of [{ sizes: "M" }, { sizes: [{}] }, { maxBudget: { increment: 1 } }, { maxBudget: -1 }, { maxBudget: Infinity },
    { minDiscountPct: 101 }, { minDiscountPct: "50" }, { colors: Array(101).fill("red") }, { fits: ["x".repeat(101)] }]) assert.throws(() => parsePreferences({ ...DEFAULT_PREFERENCES, ...patch }), AccountInputError);
  assert.deepEqual(parsePreferences({ ...DEFAULT_PREFERENCES, user: { update: { role: "ADMIN" } }, userId: "other" }), DEFAULT_PREFERENCES);
});
test("watchlist identifiers must be short nonempty strings", () => {
  for (const value of [null, [], {}, { productId: {} }, { productId: 1 }, { productId: " " }, { productId: "x".repeat(201) }]) assert.throws(() => parseProductId(value), AccountInputError);
  assert.equal(parseProductId({ productId: " p " }), "p");
});
test("body limits count actual streamed bytes and malformed JSON gets a controlled error", async () => {
  await assert.rejects(readAccountJson(new Request("http://localhost", { method: "POST", body: "{" })), AccountInputError);
  await assert.rejects(readAccountJson(new Request("http://localhost", { method: "POST", body: "x".repeat(11), headers: { "content-length": "1" } }), 10), (e: unknown) => e instanceof AccountInputError && e.status === 413);
  assert.deepEqual(await readAccountJson(new Request("http://localhost", { method: "POST", body: '{"ok":true}' })), { ok: true });
});
