import { test } from "node:test";
import assert from "node:assert/strict";
import { AccountStore } from "./account-store";
const settle = () => new Promise<void>(resolve => setImmediate(resolve));
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { resolve, promise }; }
test("account stores never share values and ignore responses after sign-out", async () => {
  const old = deferred<string[]>(); let signal!: AbortSignal;
  const a = new AccountStore<string[]>([], s => { signal = s; return old.promise; }, async () => {});
  const b = new AccountStore<string[]>([], async () => ["b-only"], async () => {});
  const unsubscribe = a.subscribe(() => {}); unsubscribe();
  b.subscribe(() => {}); await settle(); old.resolve(["a-private"]); await settle();
  assert.equal(signal.aborted, true); assert.deepEqual(a.getSnapshot().data, []);
  assert.deepEqual(b.getSnapshot().data, ["b-only"]);
});
test("multiple cards share a single load and observe each other's updates", async () => {
  let loads = 0, saves = 0, notifications = 0;
  const store = new AccountStore<string[]>([], async () => { loads++; return []; }, async () => { saves++; });
  store.subscribe(() => {}); store.subscribe(() => { notifications++; }); await settle();
  store.update(ids => [...ids, "p"]); await settle();
  assert.equal(loads, 1); assert.equal(saves, 1); assert.deepEqual(store.getSnapshot().data, ["p"]); assert.ok(notifications > 0);
});
test("serialized saves preserve rapid toggle order without duplicate requests", async () => {
  const first = deferred<void>(); const writes: string[][] = [];
  const store = new AccountStore<string[]>([], async () => [], async next => { writes.push(next); if (writes.length === 1) await first.promise; });
  store.subscribe(() => {}); await settle();
  const toggle = (ids: string[]) => ids.includes("p") ? [] : ["p"];
  store.update(toggle); store.update(toggle);
  assert.deepEqual(store.getSnapshot().data, []); assert.equal(writes.length, 1);
  first.resolve(); await settle(); assert.deepEqual(writes, [["p"], []]); assert.deepEqual(store.getSnapshot().data, []);
});
test("failed saves roll back and show an error; failed reads can retry", async () => {
  let failRead = true;
  const store = new AccountStore<string[]>([], async () => { if (failRead) throw new Error(); return ["original"]; }, async () => { throw new Error(); });
  store.subscribe(() => {}); await settle(); assert.equal(store.getSnapshot().hydrated, false); assert.ok(store.getSnapshot().error);
  failRead = false; store.reload(); await settle(); store.update(ids => [...ids, "unsaved"]); await settle();
  assert.deepEqual(store.getSnapshot().data, ["original"]); assert.match(store.getSnapshot().error!, /save/);
});
test("cleanup prevents queued writes and old completions from restoring account data", async () => {
  const pending = deferred<void>(); let calls = 0;
  const store = new AccountStore<string[]>([], async () => [], async () => { calls++; await pending.promise; });
  const unsubscribe = store.subscribe(() => {}); await settle();
  store.update(() => ["first"]); store.update(() => ["second"]); unsubscribe();
  pending.resolve(); await settle(); assert.equal(calls, 1); assert.deepEqual(store.getSnapshot().data, []);
});
test("effect replay does not let a former load replace a newer load", async () => {
  const old = deferred<string[]>(); let loads = 0;
  const store = new AccountStore<string[]>([], async () => ++loads === 1 ? old.promise : ["current"], async () => {});
  store.subscribe(() => {})(); store.subscribe(() => {}); await settle();
  old.resolve(["stale"]); await settle(); assert.deepEqual(store.getSnapshot().data, ["current"]);
});
