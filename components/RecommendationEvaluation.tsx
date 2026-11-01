"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import type { ReactNode } from "react";
import type { Exposure } from "@/lib/evaluation";
import { clearAttribution, ExposureRecorder, observeCards, sendEvaluation } from "@/lib/evaluation-client";

type Context = Pick<Exposure, "sort" | "filtered" | "personalized">;
export default function RecommendationEvaluation({ items, context, viewKey, children }: {
  viewKey: string; items: { productId: string; displayedTotal: number }[]; context: Context; children: ReactNode;
}) {
  const { data: session, status } = useSession();
  const userId = status === "authenticated" ? session?.user?.id : undefined;
  const [consent, setConsent] = useState<{ userId?: string; enabled: boolean }>({ enabled: false });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const root = useRef<HTMLDivElement>(null);
  const enabled = !!userId && consent.userId === userId && consent.enabled;
  useEffect(() => {
    let active = true;
    setLoading(true);
    setConsent({ enabled: false });
    clearAttribution();
    if (userId) fetch("/api/evaluation", { cache: "no-store" }).then(r => r.ok ? r.json() : null).then(data => {
      if (active && data) setConsent({ userId, enabled: data.enabled === true });
    }).catch(() => {}).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  // Values, not array/object identity, define a displayed result set. Changing
  // order, filters (coarsened), sort, price or personalization creates a new view.
  const signature = JSON.stringify({ items, context, viewKey });
  const snapshot = useMemo(() => ({ signature, exposures: undefined as Exposure[] | undefined,
    recorder: undefined as ExposureRecorder | undefined }), [signature, userId, enabled]);
  useEffect(() => {
    if (!enabled || !userId || !root.current) return;
    const parsed: { items: typeof items; context: Context } = JSON.parse(snapshot.signature);
    if (!snapshot.exposures) {
      const viewId = crypto.randomUUID();
      snapshot.exposures = parsed.items.map((item, i) => ({ ...item, ...parsed.context, id: crypto.randomUUID(),
        viewId, position: i + 1, resultCount: parsed.items.length }));
    }
    snapshot.recorder ??= new ExposureRecorder(userId);
    snapshot.recorder.resume();
    const byProduct = new Map(snapshot.exposures.map(exposure => [exposure.productId, exposure]));
    const disconnect = observeCards(root.current, productId => {
      const exposure = byProduct.get(productId);
      if (exposure) void snapshot.recorder!.record(exposure);
    });
    return () => { disconnect(); snapshot.recorder?.stop(); };
  }, [enabled, userId, snapshot]);

  async function changeConsent(next: boolean) {
    if (!userId) return;
    setBusy(true); setError("");
    if (!next) { snapshot.recorder?.stop(); clearAttribution(); setConsent({ userId, enabled: false }); }
    try {
      const res = await sendEvaluation({ type: "consent", enabled: next });
      if (!res.ok) throw new Error();
      setConsent({ userId, enabled: next });
    } catch { setError("Could not save your choice. Please try again."); }
    finally { setBusy(false); }
  }
  return <>
    {userId && <div className="mb-4 rounded-xl border border-ink-100 p-3 text-sm text-ink-600">
      <label className="flex items-start gap-2">
        <input type="checkbox" checked={enabled} disabled={busy || loading} onChange={e => void changeConsent(e.target.checked)} />
        <span>Help evaluate recommendations. Record visible products, their positions, prices, and related saves, unsaves, skips and retailer clicks for 30 days (deleted at the next daily cleanup), linked to your account. Turning this off deletes this evaluation history. Your recommendations work either way.</span>
      </label>
      <button type="button" disabled={busy || loading} onClick={() => void changeConsent(false)} className="mt-2 underline">Turn off and delete evaluation history</button>
      {error && <p role="alert">{error}</p>}
    </div>}
    <div ref={root} className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">{children}</div>
  </>;
}
