import { DEFAULT_WEIGHTS, featurize, predict } from "./bandit";
import { EMPTY_PROFILE, PreferenceProfile } from "./preference-model";
import { recommendationOffer, totalPrice } from "./recommendation-offer";
import { Preferences, Product } from "./types";

export interface RankedProduct { product: Product; score: number; reasons: string[] }

// Scores are calculated once, then a deterministic greedy diversity pass
// spreads near-ties across brands/categories. No randomness inside sort.
export function rankProducts(products: Product[], prefs: Preferences, weights = DEFAULT_WEIGHTS,
  profile: PreferenceProfile = EMPTY_PROFILE, now = Date.now()): RankedProduct[] {
  const candidates = products.filter(p => recommendationOffer(p, prefs) && !profile.dismissed?.includes(p.id)).map(product => {
    const f = featurize(product, prefs, profile, now);
    const offer = recommendationOffer(product, prefs)!;
    const reasons: string[] = [];
    if (f[1]) reasons.push("A favorite brand");
    if (f[7] > 0.15 || f[8] > 0.3) reasons.push("Based on your activity");
    if (f[4] > 0) reasons.push("Your size in stock");
    if (totalPrice(offer) <= prefs.maxBudget) reasons.push("Within budget including shipping");
    if (f[5] >= 0.2) reasons.push("At least 20% off");
    if (f[9] > 0.5) reasons.push("Recently updated");
    // Explicit preferences remain effective even after noisy online training.
    const penalty = (f[2] ? 0.3 : 0) + (f[4] < 0 ? 0.2 : 0) + (f[6] < 0 ? 0.15 : 0);
    return { product, score: predict(weights, f) - penalty, reasons: reasons.slice(0, 2) };
  });
  const result: RankedProduct[] = [];
  const brands = new Map<string, number>();
  const categories = new Map<string, number>();
  // Diversify the first page only, bounding the greedy pass for large catalogs.
  while (candidates.length && result.length < 24) {
    const adjusted = (r: RankedProduct) => r.score
      - 0.035 * Math.min(3, brands.get(r.product.brand.toLowerCase()) ?? 0)
      - 0.02 * Math.min(3, categories.get(r.product.category) ?? 0);
    candidates.sort((a, b) => adjusted(b) - adjusted(a) || a.product.id.localeCompare(b.product.id));
    const next = candidates.shift()!;
    result.push(next);
    const brand = next.product.brand.toLowerCase();
    brands.set(brand, (brands.get(brand) ?? 0) + 1);
    categories.set(next.product.category, (categories.get(next.product.category) ?? 0) + 1);
  }
  return result.concat(candidates.sort((a, b) => b.score - a.score || a.product.id.localeCompare(b.product.id)));
}
