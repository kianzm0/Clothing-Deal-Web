import { Preferences, Product } from "./types";
import { bestOffer, discountPct } from "./pricing";

// Rule-based scoring — same approach as the static MVP, ported to TS.
// Each signal adds or subtracts points; total score drives "best match" sort.
export function scoreProduct(product: Product, prefs: Preferences): number {
  const offer = bestOffer(product);
  let score = 0;

  if (prefs.favoriteBrands.includes(product.brand)) score += 30;
  if (prefs.dislikedBrands.includes(product.brand)) score -= 50;
  if (product.colors.some((c) => prefs.colors.includes(c))) score += 15;
  if (product.sizes.some((s) => prefs.sizes.includes(s))) score += 15;

  const discount = discountPct(offer);
  if (discount >= prefs.minDiscountPct) score += discount / 2;

  if (offer.price <= prefs.maxBudget) score += 10;
  else score -= 20;

  return score;
}
