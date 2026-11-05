import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import { prisma } from "./prisma";
import { POST } from "../app/api/deal-links/route";
import { MAX_DEAL_LINKS, MAX_DEAL_LINK_BODY_BYTES } from "./deal-links";

const nextAuth = require("next-auth/next");
const restores: Array<() => void> = [];
function stub(target: object, key: string, fn: (...args: any[]) => any) {
  const obj = target as Record<string, (...args: any[]) => any>;
  const original = obj[key], spy = mock.fn(fn);
  obj[key] = spy; restores.push(() => { obj[key] = original; });
  return spy;
}
let signedIn = true;
let role = "EDITOR";
let network: ReturnType<typeof stub>;
const url = "https://www.nike.com/product";
const request = (value: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(value) });
beforeEach(() => {
  signedIn = true; role = "EDITOR";
  stub(nextAuth, "getServerSession", async () => signedIn ? { user: { id: "editor" } } : null);
  stub(prisma.user, "findUnique", async () => ({ role }));
  network = stub(globalThis, "fetch", async () => new Response("<title>Test product</title>", { headers: { "content-type": "text/html" } }));
});
afterEach(() => { while (restores.length) restores.pop()!(); });

test("authorization runs before reading the body or fetching retailers", async () => {
  for (const [authenticated, currentRole, status] of [[false, "EDITOR", 401], [true, "USER", 403]] as const) {
    signedIn = authenticated; role = currentRole;
    const req = request({ urls: [url] });
    assert.equal((await POST(req)).status, status);
    assert.equal(req.bodyUsed, false);
  }
  assert.equal(network.mock.callCount(), 0);
});

test("invalid and oversized batches never initiate retailer work", async () => {
  for (const value of [null, [], {}, { urls: [] }, { urls: [url, 7] }, { urls: [url, "bad"] }, { urls: Array(MAX_DEAL_LINKS + 1).fill(url) }]) {
    const response = await POST(request(value));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, "string");
  }
  assert.equal((await POST(request({ urls: [url], padding: "x".repeat(MAX_DEAL_LINK_BODY_BYTES) }))).status, 413);
  assert.equal((await POST(new Request("http://localhost", { method: "POST", body: "{" }))).status, 400);
  assert.equal(network.mock.callCount(), 0);
});

test("207 retains successes, per-URL errors, order and fetch restrictions", async () => {
  network.mock.mockImplementation(async (input: string, init: RequestInit) => {
    assert.equal(init.redirect, "manual");
    assert.ok(init.signal);
    if (input.endsWith("/failed")) throw new Error("private transport details");
    if (input.endsWith("/redirect")) return new Response(null, { status: 302, headers: { location: "http://127.0.0.1" } });
    return new Response("<title>Test product</title>", { headers: { "content-type": "text/html" } });
  });
  const urls = [url, url + "/failed", "https://not-allowlisted.example/product", url + "/redirect", url + "/last"];
  const response = await POST(request({ urls }));
  assert.equal(response.status, 207);
  const body = await response.json();
  assert.deepEqual(body.results.map((r: { url: string }) => r.url), urls);
  assert.deepEqual(body.results.map((r: { ok: boolean }) => r.ok), [true, false, false, false, true]);
  assert.equal(body.results[0].deal.title, "Test product");
  assert.match(body.results[1].error.message, /Timed out or failed/);
  assert.match(body.results[2].error.message, /allowlisted/);
  assert.match(body.results[3].error.message, /redirects/);
  assert.equal(network.mock.callCount(), 4);
});

test("all-success and all-failure valid batches retain 207", async () => {
  for (const urls of [[url], ["http://www.nike.com/product", "https://not-allowlisted.example/product"]]) {
    const response = await POST(request({ urls }));
    assert.equal(response.status, 207);
    assert.equal((await response.json()).results.length, urls.length);
  }
});
