import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { GET, POST } from "../app/api/evaluation/route";
import { GET as cleanup } from "../app/api/cron/evaluation-retention/route";
import { recordExposure, recordEvaluationOutcome, setEvaluationConsent } from "./evaluation-repository";
const nextAuth = require("next-auth/next");
const restores: (() => void)[] = [];
function stub(obj: any, key: string, fn: (...args: any[]) => any) {
  const original = obj[key], spy = mock.fn(fn); obj[key] = spy; restores.push(() => { obj[key] = original; }); return spy;
}
const exposure = { id: "cb7cb553-286a-4c06-a230-a75cc1787506", viewId: "b655eb33-667a-4e1f-a2ab-3629a597fa46", productId: "p", position: 1, resultCount: 3,
  sort: "best-match" as const, filtered: false, personalized: true, displayedTotal: 20 };
let session: any, enabled: boolean, row: any, product: any, count: number;
let writes: ReturnType<typeof stub>, outcomes: ReturnType<typeof stub>, deletes: ReturnType<typeof stub>;
beforeEach(() => {
  session = { user: { id: "u" } }; enabled = true; row = null; product = { id: "p" }; count = 0;
  stub(nextAuth, "getServerSession", async () => session);
  stub(prisma, "$transaction", async fn => fn(prisma));
  stub(prisma, "$queryRaw", async () => []);
  stub(prisma.user, "findUnique", async () => ({ evaluationEnabled: enabled }));
  stub(prisma.user, "update", async ({ data }) => { enabled = data.evaluationEnabled; });
  stub(prisma.product, "findUnique", async () => product);
  stub(prisma.recommendationImpression, "findUnique", async () => row);
  stub(prisma.recommendationImpression, "count", async () => count);
  writes = stub(prisma.recommendationImpression, "upsert", async ({ create }) => ({ ...create, createdAt: new Date() }));
  outcomes = stub(prisma.recommendationOutcome, "upsert", async () => ({}));
  deletes = stub(prisma.recommendationImpression, "deleteMany", async () => ({ count: 1 }));
});
afterEach(() => { while (restores.length) restores.pop()!(); });
const request = (body: unknown, origin = "http://localhost") => new Request("http://localhost/api/evaluation", {
  method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
});
test("API requires same-origin authenticated writes and validates bounded payloads", async () => {
  assert.equal((await POST(request({ type: "consent", enabled: true }, "https://other.test"))).status, 403);
  session = null; assert.equal((await POST(request({ type: "consent", enabled: true }))).status, 401);
  assert.equal((await GET()).status, 401); session = { user: { id: "u" } };
  assert.equal((await POST(request({ type: "impression", exposure: { ...exposure, position: 0 } }))).status, 400);
  assert.equal((await POST(request({ extra: "x".repeat(5000) }))).status, 413);
  assert.equal(writes.mock.callCount(), 0);
});
test("consent defaults closed; withdrawal deletes only this account history", async () => {
  enabled = false;
  assert.equal((await recordExposure("u", exposure)).status, 403);
  assert.equal(writes.mock.callCount(), 0);
  await setEvaluationConsent("u", true); assert.equal(enabled, true);
  await setEvaluationConsent("u", false); assert.equal(enabled, false);
  assert.deepEqual(deletes.mock.calls[0].arguments[0], { where: { userId: "u" } });
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "p", "SAVE")).status, 403);
});
test("impressions bind server owner and policy; retries cannot mutate context", async () => {
  const response = await POST(request({ type: "impression", exposure: { ...exposure, userId: "victim", rankingVersion: "fake" } }));
  assert.equal(response.status, 200);
  const data = writes.mock.calls[0].arguments[0].create;
  assert.equal(data.userId, "u"); assert.equal(data.rankingVersion, "personalized-v2");
  row = { ...data, createdAt: new Date() };
  assert.equal((await recordExposure("u", exposure)).status, 200);
  assert.equal(writes.mock.callCount(), 1);
  assert.equal((await recordExposure("u", { ...exposure, position: 2 })).status, 409);
  row.userId = "victim"; assert.equal((await recordExposure("u", exposure)).status, 409);
});
test("unknown products and excessive exposure volume are rejected", async () => {
  product = null; assert.equal((await recordExposure("u", exposure)).status, 404);
  product = { id: "p" }; count = 1000; assert.equal((await recordExposure("u", exposure)).status, 429);
  assert.equal(writes.mock.callCount(), 0);
});
test("outcomes reject absent, cross-account, cross-product and expired exposures", async () => {
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "p", "SAVE")).status, 404);
  row = { ...exposure, userId: "victim", createdAt: new Date() };
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "p", "SAVE")).status, 404);
  row.userId = "u";
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "other", "SAVE")).status, 404);
  row.createdAt = new Date(Date.now() - 31 * 60000);
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "p", "SAVE")).status, 404);
  assert.equal(outcomes.mock.callCount(), 0);
  row.createdAt = new Date();
  assert.equal((await recordEvaluationOutcome("u", exposure.id, "p", "CLICK_OUT")).status, 200);
  assert.deepEqual(outcomes.mock.calls[0].arguments[0].where, { impressionId_action: { impressionId: exposure.id, action: "CLICK_OUT" } });
});
test("retention requires a configured bearer secret", async () => {
  const original = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal((await cleanup(new Request("http://localhost"))).status, 401);
    process.env.CRON_SECRET = "test-secret";
    assert.equal((await cleanup(new Request("http://localhost", { headers: { authorization: "Bearer wrong" } }))).status, 401);
    assert.equal((await cleanup(new Request("http://localhost", { headers: { authorization: "Bearer test-secret" } }))).status, 200);
    assert.ok(deletes.mock.calls[0].arguments[0].where.createdAt.lt instanceof Date);
  } finally { if (original === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = original; }
});
