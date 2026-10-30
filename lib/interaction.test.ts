import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { trainInteraction } from "./bandit-repository";
import { DEFAULT_PREFERENCES, Product } from "./types";
import { DEFAULT_WEIGHTS, featurize, updateWeights } from "./bandit";
import { EMPTY_PROFILE } from "./preference-model";
import { POST } from "../app/api/interactions/route";

const nextAuth = require("next-auth/next");
const restorations: Array<() => void> = [];
function stub(target: object, key: string, fn: (...args: any[]) => any) {
  const obj = target as Record<string, any>, original = obj[key];
  const spy = mock.fn(fn);
  obj[key] = spy;
  restorations.push(() => { obj[key] = original; });
  return spy;
}
const p: Product = { id: "p", name: "Hoodie", brand: "Nike", category: "hoodie", colors: [], sizes: ["M"], image: "",
  offers: [{ store: "Store", price: 50, originalPrice: 100, shippingCost: 0, sizesInStock: ["M"], lastUpdated: "2026-01-01", url: "#" }] };
let latest: any, recentCount: number, session: any;
let create: ReturnType<typeof stub>, upsert: ReturnType<typeof stub>, transaction: ReturnType<typeof stub>;
beforeEach(() => {
  latest = null; recentCount = 0; session = { user: { id: "user" } };
  stub(nextAuth, "getServerSession", async () => session);
  stub(prisma.product, "findUnique", async () => ({ ...p, category: "HOODIE", offers: p.offers.map(o => ({ ...o, lastUpdated: new Date(o.lastUpdated) })) }));
  stub(prisma.product, "findMany", async () => []);
  stub(prisma.banditWeights, "findUnique", async () => null);
  stub(prisma.preference, "findUnique", async () => DEFAULT_PREFERENCES);
  stub(prisma.interaction, "findMany", async () => []);
  stub(prisma.interaction, "findFirst", async () => latest);
  stub(prisma.interaction, "count", async () => recentCount);
  create = stub(prisma.interaction, "create", async () => ({}));
  upsert = stub(prisma.banditWeights, "upsert", async () => ({}));
  transaction = stub(prisma, "$transaction", async fn => fn(prisma));
});
afterEach(() => { while (restorations.length) restorations.pop()!(); mock.restoreAll(); });
const request = (body: unknown) => new Request("http://localhost/api/interactions", { method: "POST", body: JSON.stringify(body) });

test("duplicate actions within a day cause neither another event nor another gradient", async () => {
  latest = { action: "SAVE", createdAt: new Date() };
  const result = await trainInteraction("user", p, "SAVE");
  assert.equal(result.duplicate, true);
  assert.equal(create.mock.callCount(), 0);
  assert.equal(upsert.mock.callCount(), 0);
});

test("state changes are logged but excessive same-item gradients are capped", async () => {
  recentCount = 3;
  const result = await trainInteraction("user", p, "SKIP");
  assert.deepEqual(result.weights, DEFAULT_WEIGHTS);
  assert.equal(create.mock.calls[0].arguments[0].data.action, "SKIP");
});

test("training and event writes use serializable transactions and retry conflicts", async () => {
  let tries = 0;
  transaction.mock.mockImplementation(async (fn: any) => {
    if (++tries === 1) throw Object.assign(new Error("conflict"), { code: "P2034" });
    return fn(prisma);
  });
  const result = await trainInteraction("user", p, "SAVE");
  assert.equal(result.trained, true);
  assert.equal(tries, 2);
  assert.equal(transaction.mock.calls[0].arguments[1].isolationLevel, "Serializable");
  assert.equal(create.mock.callCount(), 1);
  assert.equal(upsert.mock.callCount(), 1);
});

test("non-conflict database failures propagate without retrying", async () => {
  transaction.mock.mockImplementation(async () => { throw new Error("database unavailable"); });
  await assert.rejects(trainInteraction("user", p, "SAVE"), /database unavailable/);
  assert.equal(transaction.mock.callCount(), 1);
});

test("the API validates input before product lookup or training", async () => {
  for (const body of [null, {}, { productId: {}, action: "SAVE" }, { productId: "p", action: "PURCHASE" }, { productId: " ", action: "SAVE" }]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal(transaction.mock.callCount(), 0);
});

test("client preferences, rewards and user IDs cannot control training", async () => {
  const result = await POST(request({ productId: "p", action: "SAVE", reward: -100, userId: "victim", prefs: { maxBudget: 1, sizes: "bad" } }));
  assert.equal(result.status, 200);
  assert.equal(create.mock.calls[0].arguments[0].data.userId, "user");
  assert.equal(create.mock.calls[0].arguments[0].data.reward, 1);
  const expected = updateWeights(DEFAULT_WEIGHTS, featurize(p, DEFAULT_PREFERENCES, EMPTY_PROFILE), 1);
  const weights = (await result.json()).weights;
  weights.forEach((w: number, i: number) => assert.ok(Math.abs(w - expected[i]) < 1e-6));
});

test("signed-out feedback is ignored and failed training returns a recoverable response", async () => {
  session = null;
  assert.deepEqual(await (await POST(request({}))).json(), { trained: false });
  session = { user: { id: "user" } };
  transaction.mock.mockImplementation(async () => { throw new Error("unavailable"); });
  assert.equal((await POST(request({ productId: "p", action: "SAVE" }))).status, 503);
});
