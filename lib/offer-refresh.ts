import { prisma } from "./prisma";
import { ingestDealForProduct } from "./offer-ingest";

export const DEFAULT_REFRESH_LIMIT = 10;
export const MAX_REFRESH_LIMIT = 25;
export const MAX_REFRESH_CONCURRENCY = 2;
export const REFRESH_AFTER_MS = 6 * 60 * 60 * 1000;
export const REVIEW_AFTER_MS = 24 * 60 * 60 * 1000;

type RefreshCandidate = { id: string; productId: string; url: string; lastScannedAt: Date | null };
export type OfferRefreshSummary = { selected: number; refreshed: number; heldForReview: number; failed: number };

export function clampRefreshLimit(value: string | null | undefined): number {
  const parsed = Number(value ?? DEFAULT_REFRESH_LIMIT);
  if (!Number.isInteger(parsed) || parsed < 1) return DEFAULT_REFRESH_LIMIT;
  return Math.min(parsed, MAX_REFRESH_LIMIT);
}

export async function refreshStaleOffers(now = new Date(), requestedLimit = DEFAULT_REFRESH_LIMIT): Promise<OfferRefreshSummary> {
  const limit = Math.min(Math.max(requestedLimit, 1), MAX_REFRESH_LIMIT);
  const refreshBefore = new Date(now.getTime() - REFRESH_AFTER_MS);
  const reviewBefore = new Date(now.getTime() - REVIEW_AFTER_MS);
  const candidates = await prisma.offer.findMany({
    where: { status: "active", OR: [{ lastScannedAt: null }, { lastScannedAt: { lt: refreshBefore } }] },
    orderBy: [{ lastScannedAt: "asc" }, { id: "asc" }],
    take: limit,
    select: { id: true, productId: true, url: true, lastScannedAt: true },
  });
  const summary: OfferRefreshSummary = { selected: candidates.length, refreshed: 0, heldForReview: 0, failed: 0 };
  await mapWithConcurrency(candidates, MAX_REFRESH_CONCURRENCY, async (offer) => {
    try {
      const result = await ingestDealForProduct(offer.productId, offer.url);
      const heldForReview = result.deal.status !== "active" || result.deal.availability === "out_of_stock";
      await prisma.offer.update({ where: { id: offer.id }, data: { status: heldForReview ? "needs_review" : "active" } });
      if (heldForReview) summary.heldForReview += 1; else summary.refreshed += 1;
    } catch (error) {
      summary.failed += 1;
      const isOldEnoughForReview = !offer.lastScannedAt || offer.lastScannedAt <= reviewBefore;
      if (isOldEnoughForReview) {
        await prisma.offer.update({ where: { id: offer.id }, data: { status: "needs_review" } });
        summary.heldForReview += 1;
      }
      console.warn("[offer-refresh] offer refresh failed", { offerId: offer.id, productId: offer.productId, reason: error instanceof Error ? error.message : "unknown_error", heldForReview: isOldEnoughForReview });
    }
  });
  return summary;
}

async function mapWithConcurrency<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>): Promise<void> {
  let nextIndex = 0;
  async function consume(): Promise<void> {
    while (nextIndex < items.length) { const item = items[nextIndex++]; await worker(item); }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => consume()));
}