"use client";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { DEFAULT_WEIGHTS, explorationScore, featurize, predict } from "./bandit";
import { Preferences, Product } from "./types";

export function useBandit() {
  const { status } = useSession();
  const [weights, setWeights] = useState<number[]>(DEFAULT_WEIGHTS);
  const [interactionCount, setInteractionCount] = useState(0);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/bandit-weights")
      .then((r) => r.json())
      .then((data) => {
        if (data.signedIn) {
          setWeights(data.weights);
          setInteractionCount(data.interactionCount);
          setSignedIn(true);
        }
      })
      .catch(() => {});
  }, [status]);

  // Signed-in users get the learned model (with exploration layered
  // on); everyone else gets the deterministic rule-based prior via
  // the caller's fallback — see BrowseClient.
  const scoreProduct = useCallback(
    (product: Product, prefs: Preferences): number => {
      const features = featurize(product, prefs);
      const base = predict(weights, features);
      return explorationScore(base, interactionCount);
    },
    [weights, interactionCount]
  );

  const recordInteraction = useCallback(
    async (productId: string, action: "SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT", prefs: Preferences) => {
      if (!signedIn) return; // nothing to train against for anonymous browsing
      try {
        const res = await fetch("/api/interactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productId, action, prefs }),
        });
        const data = await res.json();
        if (data.trained) {
          setWeights(data.weights);
          setInteractionCount(data.interactionCount);
        }
      } catch {
        // Best-effort: a dropped interaction just means one less
        // training example, not a broken UI.
      }
    },
    [signedIn]
  );

  return { signedIn, scoreProduct, recordInteraction };
}
