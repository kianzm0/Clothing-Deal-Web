import { prisma } from "./prisma";
import { DEFAULT_PREFERENCES, Preferences } from "./types";

export async function getWatchlistIds(userId: string): Promise<string[]> {
  const rows = await prisma.watchlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((r: { productId: string }) => r.productId);
}

export async function addToWatchlist(userId: string, productId: string): Promise<void> {
  await prisma.watchlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  });
}

export async function removeFromWatchlist(userId: string, productId: string): Promise<void> {
  await prisma.watchlistItem.deleteMany({ where: { userId, productId } });
}

export async function getPreferences(userId: string): Promise<Preferences> {
  const row = await prisma.preference.findUnique({ where: { userId } });
  if (!row) return DEFAULT_PREFERENCES;
  return {
    sizes: row.sizes,
    favoriteBrands: row.favoriteBrands,
    dislikedBrands: row.dislikedBrands,
    colors: row.colors,
    fits: row.fits,
    maxBudget: row.maxBudget,
    minDiscountPct: row.minDiscountPct,
  };
}

export async function savePreferences(userId: string, prefs: Preferences): Promise<void> {
  await prisma.preference.upsert({
    where: { userId },
    update: { ...prefs },
    create: { userId, ...prefs },
  });
}
