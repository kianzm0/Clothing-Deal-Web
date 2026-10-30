import { Preferences, Product } from "./types";
import { discountPct } from "./pricing";
import { PreferenceProfile, learnedAffinity, similarityToLiked } from "./preference-model";
import { recommendationOffer, totalPrice } from "./recommendation-offer";

// Online logistic ranker. Scores are relative preferences, not calibrated
// purchase probabilities: we only observe voluntary feedback, not impressions.
// Keep existing feature positions so persisted weights remain compatible.
export const FEATURE_NAMES = [
  "bias", "favoriteBrand", "dislikedBrand", "colorMatch", "sizeMatch",
  "discountFrac", "priceFit", "learnedAffinity", "similarToLiked",
  "freshness", "discountFit",
] as const;
export type FeatureVector = number[];
export type InteractionAction = "SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT";
export const DEFAULT_WEIGHTS = [0, 1.2, -2, 0.6, 0.6, 1, 0.8, 1.5, 1, 0.35, 0.4];
const clamp = (n: number, low: number, high: number) => Math.max(low, Math.min(high, n));

export function alignWeights(weights: number[]): number[] {
  return DEFAULT_WEIGHTS.map((prior, i) => Number.isFinite(weights[i]) ? clamp(weights[i], -6, 6) : prior);
}

export function featurize(product: Product, prefs: Preferences, profile?: PreferenceProfile, now = Date.now()): FeatureVector {
  const offer = recommendationOffer(product, prefs);
  const discount = offer ? clamp(discountPct(offer) / 100, 0, 1) : 0;
  const cost = offer ? totalPrice(offer) : Infinity;
  const budget = Math.max(1, prefs.maxBudget);
  const age = offer ? Math.max(0, (now - Date.parse(offer.lastUpdated)) / 86400000) : Infinity;
  const has = (values: string[], value: string) => values.some(v => v.trim().toLowerCase() === value.trim().toLowerCase());
  return [
    1,
    has(prefs.favoriteBrands, product.brand) ? 1 : 0,
    has(prefs.dislikedBrands, product.brand) ? 1 : 0,
    product.colors.some(c => has(prefs.colors, c)) ? 1 : 0,
    prefs.sizes.length ? (offer?.sizesInStock.some(s => has(prefs.sizes, s)) ? 1 : -1) : 0,
    discount,
    clamp((budget - cost) / budget, -1, 1),
    profile ? learnedAffinity(product, profile) : 0,
    profile ? similarityToLiked(product, profile) : 0,
    Number.isFinite(age) ? Math.pow(0.5, age / 7) : 0,
    prefs.minDiscountPct > 0 ? (discount * 100 >= prefs.minDiscountPct ? 1 : -1) : 0,
  ];
}

export function predict(weights: number[], features: FeatureVector): number {
  const z = alignWeights(weights).reduce((sum, w, i) => sum + w * (Number.isFinite(features[i]) ? features[i] : 0), 0);
  return 1 / (1 + Math.exp(-clamp(z, -30, 30)));
}

export function updateWeights(weights: number[], features: FeatureVector, reward: number, strength = 1): number[] {
  const aligned = alignWeights(weights);
  if (!Number.isFinite(reward) || !Number.isFinite(strength)) return aligned;
  const error = clamp(reward, 0, 1) - predict(aligned, features);
  const rate = 0.12 * clamp(strength, 0, 1);
  return aligned.map((w, i) => clamp(
    w + rate * (error * (Number.isFinite(features[i]) ? clamp(features[i], -1, 1) : 0)
      - 0.03 * (w - DEFAULT_WEIGHTS[i])), -6, 6
  ));
}

// A click indicates curiosity, not a purchase. Removing a saved item is
// ambiguous, whereas "not interested" is an explicit negative label.
export const REWARD_BY_ACTION: Record<InteractionAction, number> = {
  SAVE: 1, UNSAVE: 0.5, SKIP: 0, CLICK_OUT: 0.75,
};
export const STRENGTH_BY_ACTION: Record<InteractionAction, number> = {
  SAVE: 1, UNSAVE: 0.25, SKIP: 1, CLICK_OUT: 0.5,
};
