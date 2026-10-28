import { prisma } from "./prisma";
import { ReviewOverrides } from "./review";
import { scavengeProductUrl } from "./scavenger";

export async function ingestDealForProduct(productId: string, url: string, overrides: ReviewOverrides = {}) {
  const deal = await scavengeProductUrl(url);
  const existing = await prisma.offer.findFirst({ where: { productId, url: deal.canonicalUrl } });
  const priceCents = overrides.priceCents ?? deal.priceCents;
  const listPriceCents = overrides.listPriceCents ?? deal.listPriceCents;
  const priceDollars = priceCents !== null ? priceCents / 100 : existing?.price ?? 0;
  const originalPriceDollars = listPriceCents !== null ? listPriceCents / 100 : existing?.originalPrice ?? priceDollars;
  const data = {
    store: deal.retailerName,
    price: priceDollars,
    originalPrice: originalPriceDollars,
    shippingCost: existing?.shippingCost ?? 0,
    sizesInStock: overrides.sizes ?? existing?.sizesInStock ?? [],
    lastUpdated: new Date(deal.fetchedAt),
    url: deal.canonicalUrl,
    sourceUrl: deal.sourceUrl,
    retailerDomain: deal.retailerDomain,
    availability: overrides.availability ?? deal.availability,
    status: deal.status,
    confidence: deal.confidence,
    extractionSources: deal.extractionSources,
    lastScannedAt: new Date(deal.fetchedAt),
  };
  const offer = existing
    ? await prisma.offer.update({ where: { id: existing.id }, data })
    : await prisma.offer.create({ data: { ...data, productId } });
  return { deal, offer, created: !existing };
}
