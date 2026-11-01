import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { MAX_RETAILER_HTML_BYTES, ScavengerError, scavengeProductUrl } from "./scavenger";
const original = globalThis.fetch;
afterEach(() => { globalThis.fetch = original; });
const url = "https://www.nike.com/t/test";
const status = (code: number) => (error: unknown) => error instanceof ScavengerError && error.statusCode === code;
test("rejects credentialed, non-HTTPS, alternate-port and non-allowlisted URLs before network", async () => {
  let calls = 0; globalThis.fetch = async () => { calls++; throw new Error(); };
  for (const bad of ["http://www.nike.com/t/test", "https://u:p@www.nike.com/t/test", "https://www.nike.com:8443/test"]) {
    await assert.rejects(scavengeProductUrl(bad), status(400));
  }
  for (const bad of ["https://127.0.0.1/test", "https://nike.com.attacker.test/test"]) await assert.rejects(scavengeProductUrl(bad), status(422));
  assert.equal(calls, 0);
});
test("does not follow redirects to internal addresses, other hosts or even same-host paths", async () => {
  for (const location of ["http://169.254.169.254/latest/meta-data", "https://attacker.test/", "/other"]) {
    let calls = 0;
    globalThis.fetch = async (_url, options) => {
      calls++; assert.equal(options?.redirect, "manual");
      return new Response(null, { status: 302, headers: { location } });
    };
    await assert.rejects(scavengeProductUrl(url), status(422));
    assert.equal(calls, 1);
  }
});
test("limits declared and actual response size and cancels oversized streams", async () => {
  globalThis.fetch = async () => new Response("", { headers: { "content-type": "text/html", "content-length": String(MAX_RETAILER_HTML_BYTES + 1) } });
  await assert.rejects(scavengeProductUrl(url), status(413));
  for (const length of [undefined, "1"]) {
    let canceled = false;
    globalThis.fetch = async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(MAX_RETAILER_HTML_BYTES)); controller.enqueue(new Uint8Array(1)); },
      cancel() { canceled = true; },
    }), { headers: { "content-type": "text/html", ...(length ? { "content-length": length } : {}) } });
    await assert.rejects(scavengeProductUrl(url), status(413)); assert.equal(canceled, true);
  }
});
test("supports bounded HTML streams and keeps the timeout active through body consumption", async () => {
  globalThis.fetch = async () => new Response("<title>Valid shirt</title>", { headers: { "content-type": "text/html" } });
  assert.equal((await scavengeProductUrl(url)).title, "Valid shirt");
  globalThis.fetch = async (_url, options) => new Response(new ReadableStream({
    start(controller) { options?.signal?.addEventListener("abort", () => controller.error(new Error("aborted"))); },
  }), { headers: { "content-type": "text/html" } });
  await assert.rejects(scavengeProductUrl(url, { timeoutMs: 10 }), status(504));
});
