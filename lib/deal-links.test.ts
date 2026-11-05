import { test } from "node:test";
import assert from "node:assert/strict";
import {
  readDealLinks, extractDealLinks, DealLinksInputError,
  MAX_DEAL_LINK_BODY_BYTES, MAX_DEAL_LINKS, MAX_DEAL_LINK_LENGTH, DEAL_LINK_CONCURRENCY,
} from "./deal-links";

const url = "https://www.nike.com/product";
const request = (value: unknown) => new Request("http://localhost", { method: "POST", body: JSON.stringify(value) });
const inputError = (status: number) => (error: unknown) => error instanceof DealLinksInputError && error.status === status;

for (const value of [null, [], 1, "text", {}, { urls: null }, { urls: "url" }, { urls: [] },
  ...[null, 1, true, {}, [], "", "   ", "/relative", "not a URL", "file:///etc/passwd", "https://"].map(bad => ({ urls: [url, bad] }))]) {
  test(`reject invalid batch ${JSON.stringify(value)}`, async () => {
    await assert.rejects(readDealLinks(request(value)), inputError(400));
  });
}

test("reject missing and malformed JSON bodies", async () => {
  await assert.rejects(readDealLinks(new Request("http://localhost", { method: "POST" })), inputError(400));
  await assert.rejects(readDealLinks(new Request("http://localhost", { method: "POST", body: "{" })), inputError(400));
});

test("batch and URL length boundaries; retain duplicates and order", async () => {
  const urls = Array(MAX_DEAL_LINKS).fill(url);
  assert.deepEqual(await readDealLinks(request({ urls })), urls);
  await assert.rejects(readDealLinks(request({ urls: [...urls, url] })), inputError(400));
  const longest = url + "x".repeat(MAX_DEAL_LINK_LENGTH - url.length);
  assert.deepEqual(await readDealLinks(request({ urls: [longest] })), [longest]);
  await assert.rejects(readDealLinks(request({ urls: [longest + "x"] })), inputError(400));
});

function streamed(chunks: Uint8Array[], headers: HeadersInit = {}) {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({
    start(controller) { for (const chunk of chunks) controller.enqueue(chunk); },
    cancel() { cancelled = true; },
  });
  const req = new Request("http://localhost", { method: "POST", headers, body, duplex: "half" } as RequestInit);
  return { req, cancelled: () => cancelled };
}

test("reject declared oversized bodies before consuming them", async () => {
  const stream = streamed([], { "content-length": String(MAX_DEAL_LINK_BODY_BYTES + 1) });
  await assert.rejects(readDealLinks(stream.req), inputError(413));
  assert.equal(stream.cancelled(), true);
  assert.equal(stream.req.body?.locked, false);
});

for (const headers of [{}, { "content-length": "1" }] as HeadersInit[]) {
  test(`cancel oversized chunked body with headers ${JSON.stringify(headers)}`, async () => {
    const stream = streamed([new Uint8Array(MAX_DEAL_LINK_BODY_BYTES), new Uint8Array([32])], headers);
    await assert.rejects(readDealLinks(stream.req), inputError(413));
    assert.equal(stream.cancelled(), true);
    assert.equal(stream.req.body?.locked, false);
  });
}

test("count UTF-8 bytes and accept exactly the byte limit", async () => {
  const json = JSON.stringify({ urls: [url] });
  const exact = json + " ".repeat(MAX_DEAL_LINK_BODY_BYTES - json.length);
  assert.deepEqual(await readDealLinks(new Request("http://localhost", { method: "POST", body: exact })), [url]);
  await assert.rejects(readDealLinks(request({ urls: [url], extra: "é".repeat(MAX_DEAL_LINK_BODY_BYTES / 2) })), inputError(413));
});

test("decode split UTF-8 and reject invalid encoding or failed streams", async () => {
  const bytes = new TextEncoder().encode(JSON.stringify({ urls: [url + "é"] }));
  const split = bytes.indexOf(0xc3) + 1;
  const body = new ReadableStream({ start(c) { c.enqueue(bytes.slice(0, split)); c.enqueue(bytes.slice(split)); c.close(); } });
  assert.deepEqual(await readDealLinks(new Request("http://localhost", { method: "POST", body, duplex: "half" } as RequestInit)), [url + "é"]);
  const invalid = streamed([new Uint8Array([255])]);
  await assert.rejects(readDealLinks(invalid.req), inputError(400));
  assert.equal(invalid.cancelled(), true);
  const broken = new ReadableStream({ start(c) { c.error(new Error("private failure")); } });
  await assert.rejects(readDealLinks(new Request("http://localhost", { method: "POST", body: broken, duplex: "half" } as RequestInit)), inputError(400));
});

test("workers bound concurrency, refill slots, settle failures, and preserve input order", async () => {
  const urls = Array.from({ length: MAX_DEAL_LINKS }, (_, i) => `${url}/${i}`);
  const started: string[] = [];
  const releases = new Map<string, () => void>();
  let active = 0, peak = 0;
  const result = extractDealLinks(urls, async u => {
    started.push(u); active++; peak = Math.max(peak, active);
    await new Promise<void>(resolve => releases.set(u, resolve));
    active--;
    if (u === urls[1]) throw new Error("retailer failure");
    return u;
  });
  assert.deepEqual(started, urls.slice(0, DEAL_LINK_CONCURRENCY));
  // Release out of order. No clocks, network, or timing-based assertions.
  releases.get(urls[1])!();
  await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(started.length, DEAL_LINK_CONCURRENCY + 1);
  assert.equal(active, DEAL_LINK_CONCURRENCY);
  while (active) {
    for (const release of releases.values()) release();
    await new Promise<void>(resolve => setImmediate(resolve));
  }
  const settled = await result;
  assert.equal(peak, DEAL_LINK_CONCURRENCY);
  assert.deepEqual(started, urls);
  assert.deepEqual(settled.map(r => r.status), urls.map((_, i) => i === 1 ? "rejected" : "fulfilled"));
  settled.forEach((r, i) => { if (r.status === "fulfilled") assert.equal(r.value, urls[i]); });
});

test("synchronous throws and all failures do not abandon later entries", async () => {
  let calls = 0;
  const settled = await extractDealLinks([url, url, url, url], () => { calls++; throw new Error("failure"); });
  assert.equal(calls, 4);
  assert.ok(settled.every(r => r.status === "rejected"));
  assert.deepEqual(await extractDealLinks([], async () => { throw new Error("must not run"); }), []);
});
