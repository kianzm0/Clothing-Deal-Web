"use client";
import { useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_PREFERENCES, Preferences } from "./types";
import { AccountStore } from "./account-store";

// Legacy keys mixed guest and account data. Do not import them into any account.
// Fresh guest-only keys deliberately avoid displaying a former user's cache.
const WATCHLIST_KEY = "threadscout:guest:watchlist:v2";
const PREFS_KEY = "threadscout:guest:preferences:v2";
const watchlists = new Map<string, AccountStore<string[]>>();
const preferences = new Map<string, AccountStore<Preferences>>();
function readGuest<T>(key: string, fallback: T, valid: (value: unknown) => value is T): T {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(key) ?? "null");
    return valid(value) ? value : fallback;
  } catch { return fallback; }
}
const validIds = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 10000 && v.every(id => typeof id === "string" && id.length > 0 && id.length <= 200);
function validPrefs(v: unknown): v is Preferences {
  if (!v || typeof v !== "object") return false;
  const p = v as Preferences;
  return [p.sizes, p.favoriteBrands, p.dislikedBrands, p.colors, p.fits].every(a => Array.isArray(a) && a.length <= 100 && a.every(s => typeof s === "string" && s.length <= 100)) &&
    Number.isFinite(p.maxBudget) && p.maxBudget >= 0 && Number.isFinite(p.minDiscountPct) && p.minDiscountPct >= 0 && p.minDiscountPct <= 100;
}
async function request(path: string, signal: AbortSignal, method?: string, body?: unknown) {
  const response = await fetch(path, { signal, cache: "no-store", ...(method ? { method,
    headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error("Account request failed");
  return response.json();
}
function useScope() {
  const { data: session, status } = useSession();
  return status === "authenticated" && session?.user?.id ? `account:${session.user.id}` : status === "unauthenticated" ? "guest" : "loading";
}
function watchlistStore(scope: string) {
  let store = watchlists.get(scope);
  if (!store) {
    store = new AccountStore<string[]>([], async signal => {
      if (scope === "guest") return readGuest(WATCHLIST_KEY, [], validIds);
      if (scope === "loading") return [];
      const body = await request("/api/watchlist", signal);
      if (!body.signedIn || !validIds(body.ids)) throw new Error("Invalid watchlist");
      return [...new Set(body.ids)] as string[];
    }, async (next, previous, signal) => {
      if (scope === "guest") { localStorage.setItem(WATCHLIST_KEY, JSON.stringify(next)); return; }
      if (scope === "loading") return;
      const added = next.find(id => !previous.includes(id)), removed = previous.find(id => !next.includes(id));
      if (added || removed) await request("/api/watchlist", signal, added ? "POST" : "DELETE", { productId: added ?? removed });
    });
    watchlists.set(scope, store);
  }
  return store;
}
function preferenceStore(scope: string) {
  let store = preferences.get(scope);
  if (!store) {
    store = new AccountStore<Preferences>(DEFAULT_PREFERENCES, async signal => {
      if (scope === "guest") return readGuest(PREFS_KEY, DEFAULT_PREFERENCES, validPrefs);
      if (scope === "loading") return DEFAULT_PREFERENCES;
      const body = await request("/api/preferences", signal);
      if (!body.signedIn || !validPrefs(body.prefs)) throw new Error("Invalid preferences");
      return body.prefs;
    }, async (next, _previous, signal) => {
      if (scope === "guest") { localStorage.setItem(PREFS_KEY, JSON.stringify(next)); return; }
      if (scope !== "loading") await request("/api/preferences", signal, "PUT", next);
    });
    preferences.set(scope, store);
  }
  return store;
}
export function useWatchlist() {
  const scope = useScope(), store = watchlistStore(scope);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ids: state.data, hydrated: scope !== "loading" && state.hydrated, error: state.error, retry: store.reload,
    toggle: (id: string) => { if (scope !== "loading") store.update(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]); } };
}
export function usePreferences() {
  const scope = useScope(), store = preferenceStore(scope);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { prefs: state.data, hydrated: scope !== "loading" && state.hydrated, error: state.error, retry: store.reload,
    update: (next: Partial<Preferences>) => { if (scope !== "loading") store.update(prefs => ({ ...prefs, ...next })); } };
}
