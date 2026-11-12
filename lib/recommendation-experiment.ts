import { RankedProduct, rankProducts } from "./ranking";
import { PreferenceProfile } from "./preference-model";
import { Preferences, Product } from "./types";

export const EXPERIMENT_ID = "recommendation-policy-v1";
export const CONTROL_VARIANT = "control";
export const TREATMENT_VARIANT = "bounded-novelty-v1";
export const CONTROL_POLICY_VERSION = "personalized-v2";
export const TREATMENT_POLICY_VERSION = "personalized-v2-bounded-novelty";
export type ExperimentVariant = typeof CONTROL_VARIANT | typeof TREATMENT_VARIANT;
export type ExperimentConfig = { id: string; enabled: boolean; allocationBps: number; controlPolicyVersion: string; treatmentPolicyVersion: string };
export const DEFAULT_EXPERIMENT: ExperimentConfig = { id: EXPERIMENT_ID, enabled: false, allocationBps: 0, controlPolicyVersion: CONTROL_POLICY_VERSION, treatmentPolicyVersion: TREATMENT_POLICY_VERSION };

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) { hash ^= input.charCodeAt(i); hash = Math.imul(hash, 16777619); }
  return hash >>> 0;
}
export function assignVariant(userId: string, config = DEFAULT_EXPERIMENT): ExperimentVariant {
  if (!config.enabled || config.allocationBps <= 0) return CONTROL_VARIANT;
  return stableHash(`${config.id}:${userId}`) % 10000 < Math.max(0, Math.min(10000, Math.floor(config.allocationBps))) ? TREATMENT_VARIANT : CONTROL_VARIANT;
}
export function policyVersion(variant: ExperimentVariant, config = DEFAULT_EXPERIMENT) {
  return variant === TREATMENT_VARIANT ? config.treatmentPolicyVersion : config.controlPolicyVersion;
}
export function rankWithPolicy(products: Product[], prefs: Preferences, weights: number[], profile: PreferenceProfile, variant: ExperimentVariant, now = Date.now()): RankedProduct[] {
  const control = rankProducts(products, prefs, weights, profile, now);
  if (variant === CONTROL_VARIANT) return control;
  const freshness = (p: Product) => { const offer = p.offers[0]; return offer ? Math.pow(0.5, Math.max(0, (now - Date.parse(offer.lastUpdated)) / 86400000) / 14) : 0; };
  const discount = (p: Product) => { const offer = p.offers[0]; return offer && offer.originalPrice > 0 ? (offer.originalPrice - offer.price) / offer.originalPrice : 0; };
  return [...control].sort((a, b) => (b.score + 0.02 * freshness(b.product) + 0.01 * discount(b.product)) - (a.score + 0.02 * freshness(a.product) + 0.01 * discount(a.product)) || a.product.id.localeCompare(b.product.id));
}
export type ExperimentObservation = { userId: string; variant: ExperimentVariant; position: number; save: boolean; retailerClick: boolean };
export type ArmEstimate = { variant: ExperimentVariant; metric: "save" | "retailerClick"; users: number; observations: number; rate: number | null; standardError: number | null; confidenceInterval95: [number, number] | null };

function estimate(rows: ExperimentObservation[], variant: ExperimentVariant, metric: "save" | "retailerClick"): ArmEstimate {
  const selected = rows.filter(r => r.variant === variant && r.position >= 1);
  const byUser = new Map<string, { sum: number; weight: number }>();
  for (const row of selected) {
    const weight = Math.min(5, row.position);
    const item = byUser.get(row.userId) ?? { sum: 0, weight: 0 };
    item.sum += (row[metric === "save" ? "save" : "retailerClick"] ? 1 : 0) * weight; item.weight += weight; byUser.set(row.userId, item);
  }
  const means = [...byUser.values()].map(v => v.weight ? v.sum / v.weight : 0);
  if (!means.length) return { variant, metric, users: 0, observations: 0, rate: null, standardError: null, confidenceInterval95: null };
  const rate = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.length > 1 ? means.reduce((a, b) => a + (b - rate) ** 2, 0) / (means.length - 1) : 0;
  const se = means.length > 1 ? Math.sqrt(variance / means.length) : null;
  return { variant, metric, users: means.length, observations: selected.length, rate, standardError: se,
    confidenceInterval95: se === null ? null : [Math.max(0, rate - 1.96 * se), Math.min(1, rate + 1.96 * se)] };
}
export function estimateSaveRate(rows: ExperimentObservation[], variant: ExperimentVariant) { return estimate(rows, variant, "save"); }
export function estimateRetailerClickRate(rows: ExperimentObservation[], variant: ExperimentVariant) { return estimate(rows, variant, "retailerClick"); }
export function compareExperiment(rows: ExperimentObservation[]) {
  const compare = (metric: "save" | "retailerClick") => {
    const control = estimate(rows, CONTROL_VARIANT, metric), treatment = estimate(rows, TREATMENT_VARIANT, metric);
    const difference = control.rate !== null && treatment.rate !== null ? treatment.rate - control.rate : null;
    const standardError = control.standardError !== null && treatment.standardError !== null ? Math.sqrt(control.standardError ** 2 + treatment.standardError ** 2) : null;
    return { control, treatment, difference, standardError, confidenceInterval95: difference !== null && standardError !== null ? [difference - 1.96 * standardError, difference + 1.96 * standardError] as [number, number] : null };
  };
  return { save: compare("save"), retailerClick: compare("retailerClick") };
}
