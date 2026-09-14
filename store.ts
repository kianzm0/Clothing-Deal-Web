"use client";
import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_PREFERENCES, Preferences } from "./types";

// Client-side persistence layer. Signed-out visitors get exactly the
// original localStorage behavior from Phase 1. Signed-in users get
// a server-backed twin (Phase 6) behind the same hook names, so no
// component had to change — they still just call useWatchlist() /
// usePreferences(). The one extra piece is a one-time migration: if
// someone built up a watchlist or preferences while signed out, that
// data gets pushed to their account the moment they sign in, instead
// of silently vanishing.

const WATCHLIST_KEY = "threadscout:watchlist";
const PREFS_KEY = "threadscout:preferences";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function useWatchlist() {
  const { status } = useSession();
  const [ids, setIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const migrated = useRef(false);

  // Local read is instant, so the UI never waits on a network round
  // trip just to know what's saved.
  useEffect(() => {
    setIds(readJSON<string[]>(WATCHLIST_KEY, []));
    setHydrated(true);
  }, []);

  // Once authenticated, reconcile with the server: anything saved
  // locally before sign-in gets pushed up once, then the server
  // becomes the source of truth for the rest of the session.
  useEffect(() => {
    if (status !== "authenticated" || migrated.current) return;
    migrated.current = true;

    (async () => {
      const res = await fetch("/api/watchlist").then((r) => r.json()).catch(() => null);
      if (!res?.signedIn) return;

      const local = readJSON<string[]>(WATCHLIST_KEY, []);
      const serverIds: string[] = res.ids;
      const localOnly = local.filter((id) => !serverIds.includes(id));

      await Promise.all(
        localOnly.map((productId) =>
          fetch("/api/watchlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId }),
          }).catch(() => {})
        )
      );

      const merged = [...serverIds, ...localOnly];
      setIds(merged);
      writeJSON(WATCHLIST_KEY, merged);
      setSignedIn(true);
    })();
  }, [status]);

  function toggle(id: string) {
    setIds((prev) => {
      const isRemoving = prev.includes(id);
      const next = isRemoving ? prev.filter((x) => x !== id) : [...prev, id];
      writeJSON(WATCHLIST_KEY, next);

      if (signedIn) {
        const request = isRemoving
          ? fetch("/api/watchlist", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: id }),
            })
          : fetch("/api/watchlist", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ productId: id }),
            });
        request.catch(() => {}); // best-effort; localStorage already has the correct state
      }

      return next;
    });
  }

  return { ids, toggle, hydrated };
}

export function usePreferences() {
  const { status } = useSession();
  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [hydrated, setHydrated] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const migrated = useRef(false);

  useEffect(() => {
    setPrefs(readJSON<Preferences>(PREFS_KEY, DEFAULT_PREFERENCES));
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (status !== "authenticated" || migrated.current) return;
    migrated.current = true;

    (async () => {
      const res = await fetch("/api/preferences").then((r) => r.json()).catch(() => null);
      if (!res?.signedIn) return;

      const local = readJSON<Preferences>(PREFS_KEY, DEFAULT_PREFERENCES);
      const localCustomized = JSON.stringify(local) !== JSON.stringify(DEFAULT_PREFERENCES);
      const serverCustomized = JSON.stringify(res.prefs) !== JSON.stringify(DEFAULT_PREFERENCES);

      // If preferences were set locally before sign-in and the server
      // has nothing yet, push the local ones up rather than discarding
      // them. If the server already has its own, that wins instead.
      const finalPrefs = !serverCustomized && localCustomized ? local : res.prefs;

      if (!serverCustomized && localCustomized) {
        await fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPrefs),
        }).catch(() => {});
      }

      setPrefs(finalPrefs);
      writeJSON(PREFS_KEY, finalPrefs);
      setSignedIn(true);
    })();
  }, [status]);

  function update(next: Partial<Preferences>) {
    setPrefs((prev) => {
      const merged = { ...prev, ...next };
      writeJSON(PREFS_KEY, merged);

      if (signedIn) {
        fetch("/api/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(merged),
        }).catch(() => {});
      }

      return merged;
    });
  }

  return { prefs, update, hydrated };
}
