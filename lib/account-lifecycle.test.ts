import assert from "node:assert/strict";
import { test } from "node:test";
import { tokenHash, validToken } from "./account-lifecycle";
import { POST as action } from "../app/api/account/route";
import { POST as token } from "../app/api/account/token/route";
test("account mutations reject cross-origin requests before any account lookup", async () => {
  for (const handler of [action, token]) {
    const response = await handler(new Request("https://threadscout.example/api/account", { method: "POST", headers: { origin: "https://attacker.example" }, body: "{}" }));
    assert.equal(response.status, 403);
  }
});
test("recovery token parsing rejects malformed and unbounded credentials", () => {
  assert.ok(validToken("a".repeat(64)));
  for (const input of [null, {}, "", "x".repeat(64), "a".repeat(65)]) assert.equal(validToken(input), false);
  assert.notEqual(tokenHash("a".repeat(64)), "a".repeat(64));
});
