"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { ExperimentVariant, EXPERIMENT_ID } from "./recommendation-experiment";
export function useExperiment() {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const [generation, setGeneration] = useState(0);
  const sequence = useRef(0);
  const [consentAllowed, setConsentAllowed] = useState<boolean | null>(null);
  const [state, setState] = useState<{ userId?: string; experimentId?: string; variant: ExperimentVariant }>({ variant: "control" });
  useEffect(() => {
    let active = true;
    const abort = new AbortController();
    async function refresh() {
      const current = ++sequence.current;
      if (!userId || consentAllowed === false) { setState({ variant: "control" }); return; }
      try {
        const res = await fetch("/api/recommendation-experiment", { cache: "no-store", signal: abort.signal });
        const data = res.ok ? await res.json() : null;
        if (active && current === sequence.current) setState(data?.experimentId === EXPERIMENT_ID && ["control", "bounded-novelty-v1"].includes(data.variant)
          ? { userId, experimentId: data.experimentId, variant: data.variant } : { userId, variant: "control" });
      } catch { if (active && current === sequence.current) setState({ userId, variant: "control" }); }
    }
    void refresh();
    const timer = setInterval(() => { void refresh(); }, 30000);
    window.addEventListener("focus", refresh);
    return () => { active = false; sequence.current++; abort.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); };
  }, [userId, generation, consentAllowed]);
  const changeConsent = useCallback((enabled: boolean) => {
    setConsentAllowed(enabled);
    sequence.current++; setState({ variant: "control" }); setGeneration(g => g + 1);
  }, []);
  return { ...(state.userId === userId ? state : { variant: "control" as ExperimentVariant, experimentId: undefined }), changeConsent };
}
