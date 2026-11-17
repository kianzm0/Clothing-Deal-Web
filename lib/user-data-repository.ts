import { AccountInputError } from "./account-input";
import { prisma } from "./prisma";
import { DEFAULT_PREFERENCES, Preferences } from "./types";

export async function getWatchlistIds(userId: string): Promise<string[]> {
  const rows = await prisma.watchlistItem.findMany({ where: { userId }, select: { productId: true } });
  return rows.map((r: { productId: string }) => r.productId);
}

export async function addToWatchlist(userId: string, productId: string): Promise<void> {
  const product = await prisma.product.findUnique({ where: { id: productId }, select: { id: true } });
  if (!product) throw new AccountInputError("Product not found.", 404);
  try { await prisma.watchlistItem.upsert({
    where: { userId_productId: { userId, productId } },
    update: {},
    create: { userId, productId },
  }); } catch (error) {
    // The product may have been deleted after the existence check.
    if ((error as { code?: string }).code === "P2003") throw new AccountInputError("Product no longer available.", 404);
    throw error;
  }
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
  // Preferences come from a public account API. Never pass arbitrary input to
  // Prisma: relation writes such as user.update could otherwise grant a role.
  const data = {
    sizes: prefs.sizes,
    favoriteBrands: prefs.favoriteBrands,
    dislikedBrands: prefs.dislikedBrands,
    colors: prefs.colors,
    fits: prefs.fits,
    maxBudget: prefs.maxBudget,
    minDiscountPct: prefs.minDiscountPct,
  };
  await prisma.preference.upsert({
    where: { userId },
    update: data,
    create: { userId, ...data },
  });
}

