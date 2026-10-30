import { Offer, Preferences, Product } from "./types";

export const totalPrice = (offer: Offer) => offer.price + offer.shippingCost;

export function eligibleOffers(product: Product): Offer[] {
  return product.offers.filter(offer =>
    offer.status !== "needs_review" &&
    !/out.?of.?stock|sold.?out|discontinued/i.test(offer.availability ?? "") &&
    Number.isFinite(offer.price) && offer.price >= 0 &&
    Number.isFinite(offer.shippingCost) && offer.shippingCost >= 0
  );
}

// Prefer an offer that actually stocks a selected size; product-level sizes
// describe the catalogue and do not guarantee stock at a retailer.
export function recommendationOffer(product: Product, prefs: Preferences): Offer | undefined {
  const offers = eligibleOffers(product);
  const sizes = new Set(prefs.sizes.map(s => s.trim().toLowerCase()));
  const matching = offers.filter(o => o.sizesInStock.some(s => sizes.has(s.trim().toLowerCase())));
  return [...(matching.length ? matching : offers)].sort((a, b) => totalPrice(a) - totalPrice(b))[0];
}
