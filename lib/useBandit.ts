"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_WEIGHTS, alignWeights, InteractionAction } from "./bandit";
import { EMPTY_PROFILE, PreferenceProfile } from "./preference-model";
import { Preferences } from "./types";

export function useBandit() {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const generation = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const [state, setState] = useState({ userId: undefined as string | undefined,
    weights: DEFAULT_WEIGHTS, profile: EMPTY_PROFILE, interactionCount: 0 });

  useEffect(() => {
    const current = ++generation.current;
    setState({ userId: undefined, weights: DEFAULT_WEIGHTS, profile: EMPTY_PROFILE, interactionCount: 0 });
    if (!userId) return;
    const controller = new AbortController();
    fetch("/api/bandit-weights", { signal: controller.signal, cache: "no-store" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.signedIn && generation.current === current) {
          setState({ userId, weights: alignWeights(data.weights), profile: data.profile ?? EMPTY_PROFILE,
            interactionCount: data.interactionCount });
        }
      }).catch(() => {});
    return () => { controller.abort(); generation.current++; };
  }, [userId]);

  const signedIn = !!userId && state.userId === userId;
  const recordInteraction = useCallback(
    (productId: string, action: InteractionAction, _prefs: Preferences) => {
      if (!signedIn) return;
      const current = generation.current;
      // Preserve the user's action order and reject responses for a former
      // account. Server transactions also protect concurrent tabs/devices.
      queue.current = queue.current.catch(() => {}).then(async () => {
        if (generation.current !== current) return;
        try {
          const res = await fetch("/api/interactions", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ productId, action }), keepalive: true,
          });
          if (!res.ok) return;
          const data = await res.json();
          if (data.trained && generation.current === current) {
            setState(prev => data.interactionCount < prev.interactionCount ? prev : {
              userId, weights: alignWeights(data.weights), interactionCount: data.interactionCount,
              profile: (data.profile ?? EMPTY_PROFILE) as PreferenceProfile,
            });
          }
        } catch { /* Feedback failure must not break browsing. */ }
      });
    }, [signedIn, userId]
  );

  return { signedIn, weights: signedIn ? state.weights : DEFAULT_WEIGHTS,
    profile: signedIn ? state.profile : EMPTY_PROFILE, recordInteraction };
}
