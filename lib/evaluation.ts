/** Increment when ranking policy changes. Experiment policy versions are stored separately. */
export const RANKING_VERSION = "personalized-v2";
export const ATTRIBUTION_MS = 30 * 60 * 1000;
export const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
export const SORTS = ["best-match", "lowest-price", "biggest-discount", "freshest"] as const;
export const ACTIONS = ["SAVE", "UNSAVE", "SKIP", "CLICK_OUT"] as const;
export type EvaluationAction = typeof ACTIONS[number];
export type Exposure = {
  id: string; viewId: string; productId: string; position: number; resultCount: number;
  sort: typeof SORTS[number]; filtered: boolean; personalized: boolean; displayedTotal: number;
  experimentId?: string; experimentVariant?: "control" | "bounded-novelty-v1";
};
const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
export const validExposureId = uuid;
export function parseExposure(value: unknown): Exposure | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Exposure;
  if (!uuid(v.id) || !uuid(v.viewId) || typeof v.productId !== "string" || !v.productId.trim() || v.productId.length > 200 ||
    !Number.isInteger(v.position) || v.position < 1 || !Number.isInteger(v.resultCount) || v.resultCount < v.position || v.resultCount > 10000 ||
    !SORTS.includes(v.sort) || typeof v.filtered !== "boolean" || typeof v.personalized !== "boolean" ||
    !Number.isFinite(v.displayedTotal) || v.displayedTotal < 0 || v.displayedTotal > 1000000) return null;
  if (v.experimentId !== undefined && (typeof v.experimentId !== "string" || v.experimentId.length > 100)) return null;
  if (v.experimentVariant !== undefined && !["control", "bounded-novelty-v1"].includes(v.experimentVariant)) return null;
  return { id: v.id, viewId: v.viewId, productId: v.productId, position: v.position, resultCount: v.resultCount,
    sort: v.sort, filtered: v.filtered, personalized: v.personalized, displayedTotal: v.displayedTotal,
    experimentId: v.experimentId, experimentVariant: v.experimentVariant };
}
export function isAttributable(impression: { userId: string; productId: string; createdAt: Date }, userId: string, productId: string, now: Date) {
  const age = now.getTime() - impression.createdAt.getTime();
  return impression.userId === userId && impression.productId === productId && age >= 0 && age <= ATTRIBUTION_MS;
}
export type MetricRow = { id: string; createdAt: Date; outcomes: { action: string; createdAt: Date }[] };
export function evaluationMetrics(rows: MetricRow[], asOf = new Date()) {
  const eligible = rows.filter(r => r.createdAt.getTime() <= asOf.getTime() - ATTRIBUTION_MS);
  const count = (action: string) => eligible.filter(r => r.outcomes.some(o => o.action === action && o.createdAt >= r.createdAt && o.createdAt.getTime() <= r.createdAt.getTime() + ATTRIBUTION_MS && o.createdAt <= asOf)).length;
  const impressions = eligible.length;
  const saves = count("SAVE"), retailerClicks = count("CLICK_OUT"), skips = count("SKIP"), unsaves = count("UNSAVE");
  return { impressions, pendingImpressions: rows.length - impressions, saves, retailerClicks, skips, unsaves,
    saveRate: impressions ? saves / impressions : null, retailerClickRate: impressions ? retailerClicks / impressions : null,
    skipRate: impressions ? skips / impressions : null, unsaveRate: impressions ? unsaves / impressions : null };
}
