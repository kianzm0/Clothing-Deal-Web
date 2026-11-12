import { RankedProduct, rankProducts } from "./ranking";
import { PreferenceProfile } from "./preference-model";
import { Preferences, Product } from "./types";

export const EXPERIMENT_ID = "recommendation-policy-v1";
export const CONTROL_VARIANT = "control";
export const TREATMENT_VARIANT = "bounded-novelty-v1";
export const CONTROL_POLICY_VERSION = "personalized-v2";
export const TREATMENT_POLICY_VERSION = "personalized-v2-bounded-novelty";
export type ExperimentVariant = typeof CONTROL_VARIANT | typeof TREATMENT_VARIANT;

export type ExperimentConfig = {
  id: string;
  enabled: boolean;
  allocationBps: number;
  controlPolicyVersion: string;
  treatmentPolicyVersion: string;
};

export const DEFAULT_EXPERIMENT: ExperimentConfig = {
  id: EXPERIMENT_ID,
  enabled: false,
  allocationBps: 0,
  controlPolicyVersion: CONTROL_POLICY_VERSION,
  treatmentPolicyVersion: TREATMENT_POLICY_VERSION,
};

function stableHash(input: string): number {
  let hash = 2166136261;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function assignVariant(userId: string, config = DEFAULT_EXPERIMENT): ExperimentVariant {
  if (!config.enabled || config.allocationBps <= 0) return CONTROL_VARIANT;
  const allocation = Math.max(0, Math.min(10000, Math.floor(config.allocationBps)));
  return stableHash(`${config.id}:${userId}`) % 10000 < allocation ? TREATMENT_VARIANT : CONTROL_VARIANT;
}

export function policyVersion(variant: ExperimentVariant, config = DEFAULT_EXPERIMENT) {
  return variant === TREATMENT_VARIANT ? config.treatmentPolicyVersion : config.controlPolicyVersion;
}

export function rankWithPolicy(
  products: Product[], prefs: Preferences, weights: number[], profile: PreferenceProfile,
  variant: ExperimentVariant, now = Date.now(),
): RankedProduct[] {
  const control = rankProducts(products, prefs, weights, profile, now);
  if (variant === CONTROL_VARIANT) return control;
  // Bounded, deterministic treatment: preserve the existing score/order signal and
  // add only a small freshness/discount tie-break. No per-request randomness.
  return [...control].sort((a, b) => {
    const freshness = (p: Product) => {
      const offer = p.offers[0];
      return offer ? Math.pow(0.5, Math.max(0, (now - Date.parse(offer.lastUpdated)) / 86400000) / 14) : 0;
    };
    const discount = (p: Product) => {
      const offer = p.offers[0];
      return offer && offer.originalPrice > 0 ? (offer.originalPrice - offer.price) / offer.originalPrice : 0;
    };
    const treatmentScore = (r: RankedProduct) => r.score + 0.02 * freshness(r.product) + 0.01 * discount(r.product);
    return treatmentScore(b) - treatmentScore(a) || a.product.id.localeCompare(b.product.id);
  });
}

export type ExperimentObservation = {
  userId: string; variant: ExperimentVariant; position: number;
  save: boolean; retailerClick: boolean;
};

export type ArmEstimate = {
  variant: ExperimentVariant; users: number; observations: number; rate: number | null;
  standardError: number | null; confidenceInterval95: [number, number] | null;
};

// Account-level cluster means prevent repeated impressions from being treated as
// independent. Position weighting is capped inverse-propensity weighting: higher
// positions receive less weight, without letting tail observations dominate.
export function estimateSaveRate(rows: ExperimentObservation[], variant: ExperimentVariant): ArmEstimate {
  const selected = rows.filter(r => r.variant === variant && r.position >= 1);
  const byUser = new Map<string, { sum: number; weight: number; n: number }>();
  for (const row of selected) {
    const weight = Math.min(5, row.position);
    const item = byUser.get(row.userId) ?? { sum: 0, weight: 0, n: 0 };
    item.sum += (row.save ? 1 : 0) * weight; item.weight += weight; item.n++;
    byUser.set(row.userId, item);
  }
  const means = [...byUser.values()].map(v => v.weight ? v.sum / v.weight : 0);
  if (!means.length) return { variant, users: 0, observations: 0, rate: null, standardError: null, confidenceInterval95: null };
  const rate = means.reduce((a, b) => a + b, 0) / means.length;
  const variance = means.length > 1 ? means.reduce((a, b) => a + (b - rate) ** 2, 0) / (means.length - 1) : 0;
  const se = Math.sqrt(variance / means.length);
  return { variant, users: means.length, observations: selected.length, rate, standardError: means.length > 1 ? se : null,
    confidenceInterval95: means.length > 1 ? [Math.max(0, rate - 1.96 * se), Math.min(1, rate + 1.96 * se)] : null };
}

export function compareExperiment(rows: ExperimentObservation[]) {
  const control = estimateSaveRate(rows, CONTROL_VARIANT);
  const treatment = estimateSaveRate(rows, TREATMENT_VARIANT);
  const difference = control.rate !== null && treatment.rate !== null ? treatment.rate - control.rate : null;
  const se = control.standardError !== null && treatment.standardError !== null
    ? Math.sqrt(control.standardError ** 2 + treatment.standardError ** 2) : null;
  return { control, treatment, difference, standardError: se,
    confidenceInterval95: difference !== null && se !== null
      ? [difference - 1.96 * se, difference + 1.96 * se] as [number, number] : null };
}
