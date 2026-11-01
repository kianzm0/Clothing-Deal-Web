import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { POST as signup } from "../app/api/signup/route";
import { PUT as preferences } from "../app/api/preferences/route";
import { POST as save, DELETE as remove } from "../app/api/watchlist/route";
import { DEFAULT_PREFERENCES } from "./types";
const nextAuth = require("next-auth/next");
const restores: Array<() => void> = [];
function stub(obj: any, key: string, fn: (...args: any[]) => any) { const original = obj[key], spy = mock.fn(fn); obj[key] = spy; restores.push(() => { obj[key] = original; }); return spy; }
let session: any;
let writes: ReturnType<typeof stub>[];
beforeEach(() => {
  session = { user: { id: "owner" } };
  stub(nextAuth, "getServerSession", async () => session);
  stub(prisma.user, "findUnique", async () => null);
  writes = [stub(prisma.user, "create", async () => ({ id: "u", email: "a@example.test" })),
    stub(prisma.preference, "upsert", async () => ({})), stub(prisma.watchlistItem, "upsert", async () => ({})), stub(prisma.watchlistItem, "deleteMany", async () => ({}))];
});
afterEach(() => { while (restores.length) restores.pop()!(); });
const request = (value: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(value) });
test("invalid account requests never reach writes", async () => {
  for (const route of [signup, preferences, save, remove]) {
    for (const input of [null, [], {}, { productId: {} }]) assert.equal((await route(request(input))).status, 400);
    assert.equal((await route(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
    assert.equal((await route(request({ extra: "x".repeat(20000) }))).status, 413);
  }
  assert.ok(writes.every(w => w.mock.callCount() === 0));
});
test("authenticated writes validate only after checking the session", async () => {
  session = null;
  for (const route of [preferences, save, remove]) assert.equal((await route(request(null))).status, 401);
});
test("registration races return conflict, not a leaked database error", async () => {
  writes[0].mock.mockImplementation(async () => { throw Object.assign(new Error("private database details"), { code: "P2002" }); });
  const res = await signup(request({ email: " A@EXAMPLE.test ", password: "example-password" }));
  assert.equal(res.status, 409); assert.doesNotMatch(await res.text(), /private database/);
});
test("database failures return recoverable responses without internals", async () => {
  for (const w of writes) w.mock.mockImplementation(async () => { throw new Error("private database details"); });
  for (const [route, body] of [[preferences, DEFAULT_PREFERENCES], [save, { productId: "p" }], [remove, { productId: "p" }]] as const) {
    const res = await route(request(body)); assert.equal(res.status, 503); assert.doesNotMatch(await res.text(), /private database/);
  }
});
