import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTION_MS, evaluationMetrics, isAttributable, parseExposure } from "./evaluation";
import { ExposureRecorder, observeCards, recordAttributedAction, clearAttribution } from "./evaluation-client";
const exposure = { id: "cb7cb553-286a-4c06-a230-a75cc1787506", viewId: "b655eb33-667a-4e1f-a2ab-3629a597fa46", productId: "product",
  position: 1, resultCount: 6, sort: "best-match" as const, filtered: false, personalized: true, displayedTotal: 25 };
test("strict validation drops arbitrary personal metadata and rejects invalid positions", () => {
  assert.deepEqual(parseExposure({ ...exposure, userId: "victim", preferences: { sizes: ["M"] } }), exposure);
  for (const patch of [{ position: 0 }, { position: 7 }, { position: 1.5 }, { resultCount: 10001 }, { sort: "random" },
    { id: "not-a-uuid" }, { displayedTotal: Infinity }, { productId: "" }, { filtered: "yes" }]) assert.equal(parseExposure({ ...exposure, ...patch }), null);
  assert.equal(parseExposure(null), null);
});
test("attribution requires the same owner, product, chronological order and 30 minute window", () => {
  const at = new Date("2026-10-31T12:00:00Z"), row = { userId: "u", productId: "p", createdAt: at };
  assert.equal(isAttributable(row, "u", "p", new Date(+at + ATTRIBUTION_MS)), true);
  for (const [u, p, time] of [["other", "p", +at], ["u", "other", +at], ["u", "p", +at - 1], ["u", "p", +at + ATTRIBUTION_MS + 1]] as const) {
    assert.equal(isAttributable(row, u, p, new Date(time)), false);
  }
});
test("metrics deduplicate outcomes, include ignored exposures, exclude immature and late events", () => {
  const at = new Date("2026-10-31T12:00:00Z"), now = new Date(+at + ATTRIBUTION_MS);
  const metrics = evaluationMetrics([
    { id: "a", createdAt: at, outcomes: [{ action: "SAVE", createdAt: at }, { action: "SAVE", createdAt: at }, { action: "CLICK_OUT", createdAt: now }] },
    { id: "b", createdAt: at, outcomes: [] },
    { id: "c", createdAt: at, outcomes: [{ action: "SAVE", createdAt: new Date(+now + 1) }, { action: "SKIP", createdAt: new Date(+at - 1) }] },
    { id: "d", createdAt: now, outcomes: [{ action: "SAVE", createdAt: now }] },
  ], now);
  assert.equal(metrics.impressions, 3); assert.equal(metrics.pendingImpressions, 1);
  assert.equal(metrics.saveRate, 1 / 3); assert.equal(metrics.retailerClickRate, 1 / 3); assert.equal(metrics.skipRate, 0);
  assert.equal(evaluationMetrics([], now).saveRate, null);
});
test("rerenders, concurrent observations and reentry produce one accepted exposure", async () => {
  let calls = 0;
  const recorder = new ExposureRecorder("u", async () => { calls++; return Response.json({ id: exposure.id }); });
  await Promise.all([recorder.record(exposure), recorder.record(exposure)]);
  recorder.stop(); recorder.resume(); // effect cleanup/setup, including StrictMode
  await recorder.record(exposure);
  assert.equal(calls, 1);
  await recorder.record({ ...exposure, id: "ca7cb553-286a-4c06-a230-a75cc1787506" });
  assert.equal(calls, 2);
});
test("ambiguous network failures retry the same id; stopping prevents new sends", async () => {
  const ids: string[] = [];
  const recorder = new ExposureRecorder("u", async body => {
    ids.push((body as any).exposure.id);
    if (ids.length === 1) throw new Error("lost response");
    return Response.json({ id: exposure.id });
  });
  await recorder.record(exposure);
  assert.deepEqual(ids, [exposure.id, exposure.id]);
  recorder.stop(); await recorder.record({ ...exposure, id: "other" });
  assert.equal(ids.length, 2);
});
test("viewport dwell cancels on scroll, hidden tabs and cleanup; unsupported browsers emit nothing", () => {
  const saved = Object.fromEntries(["document", "IntersectionObserver", "setTimeout", "clearTimeout"].map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
  const timers = new Map<number, () => void>(); let serial = 0;
  let callback: (entries: any[]) => void = () => {};
  const listeners = new Map<string, () => void>();
  const card = { isConnected: true, hasAttribute: () => true, getAttribute: () => "p" };
  const doc = { visibilityState: "visible", addEventListener: (k: string, v: () => void) => listeners.set(k, v), removeEventListener: (k: string) => listeners.delete(k) };
  const root = { querySelectorAll: () => [card] } as unknown as HTMLElement;
  let count = 0;
  try {
    Object.assign(globalThis, { document: doc, IntersectionObserver: class {
      constructor(cb: typeof callback) { callback = cb; } observe() {} disconnect() {}
    }, setTimeout: (fn: () => void) => { timers.set(++serial, fn); return serial; }, clearTimeout: (id: number) => timers.delete(id) });
    const cleanup = observeCards(root, () => count++);
    const emit = (ratio: number) => callback([{ target: card, isIntersecting: ratio > 0, intersectionRatio: ratio }]);
    const tick = () => { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); };
    emit(0.49); tick(); assert.equal(count, 0);
    emit(0.5); emit(0); tick(); assert.equal(count, 0);
    emit(1); doc.visibilityState = "hidden"; listeners.get("visibilitychange")!(); tick(); assert.equal(count, 0);
    doc.visibilityState = "visible"; listeners.get("visibilitychange")!(); tick(); assert.equal(count, 0);
    emit(0.5); tick(); assert.equal(count, 1);
    emit(1); cleanup(); tick(); assert.equal(count, 1); assert.equal(listeners.size, 0);
    (globalThis as any).IntersectionObserver = undefined;
    observeCards(root, () => count++)(); assert.equal(count, 1);
  } finally {
    for (const [key, descriptor] of Object.entries(saved)) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete (globalThis as any)[key];
    }
  }
});

test("attribution storage is account-scoped, expires, and clears on withdrawal", async () => {
  const storageDescriptor = Object.getOwnPropertyDescriptor(globalThis, "sessionStorage");
  const originalFetch = globalThis.fetch;
  const storage = new Map<string, string>();
  const sent: any[] = [];
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key),
  } });
  globalThis.fetch = async (_url, options) => { sent.push(JSON.parse(options!.body as string)); return Response.json({}); };
  try {
    const recorder = new ExposureRecorder("owner", async () => Response.json({ id: exposure.id }));
    await recorder.record(exposure);
    recordAttributedAction("other", exposure.productId, "SAVE");
    recordAttributedAction("owner", "other-product", "SAVE");
    assert.equal(sent.length, 0);
    recordAttributedAction("owner", exposure.productId, "CLICK_OUT");
    assert.equal(sent.length, 1); assert.equal(sent[0].impressionId, exposure.id);
    for (const [key, value] of storage) storage.set(key, JSON.stringify(JSON.parse(value).map((r: any) => ({ ...r, at: Date.now() - ATTRIBUTION_MS - 1 }))));
    recordAttributedAction("owner", exposure.productId, "SAVE"); assert.equal(sent.length, 1);
    clearAttribution(); assert.equal(storage.size, 0);
    recordAttributedAction("owner", exposure.productId, "SAVE"); assert.equal(sent.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    if (storageDescriptor) Object.defineProperty(globalThis, "sessionStorage", storageDescriptor); else delete (globalThis as any).sessionStorage;
  }
});
