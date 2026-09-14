import { Offer, Product } from "./types";

export function bestOffer(product: Product): Offer {
  return [...product.offers].sort((a, b) => a.price + a.shippingCost - (b.price + b.shippingCost))[0];
}

export function discountPct(offer: Offer): number {
  if (offer.originalPrice <= 0) return 0;
  return Math.round(((offer.originalPrice - offer.price) / offer.originalPrice) * 100);
}

export function daysSinceUpdate(offer: Offer): number {
  const ms = Date.now() - new Date(offer.lastUpdated).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}
