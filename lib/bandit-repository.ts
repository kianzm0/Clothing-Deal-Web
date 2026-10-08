import { prisma } from "./prisma";
import { DEFAULT_WEIGHTS, alignWeights } from "./bandit";
import { getProductsByIds } from "./repository";
import { Observation, PreferenceProfile, buildProfile } from "./preference-model";

// How much history the preference model looks at. With a 30-day
// half-life, anything older than a few hundred events contributes
// almost nothing anyway.
const PROFILE_HISTORY_LIMIT = 300;

export async function getWeights(userId: string): Promise<number[]> {
  const row = await prisma.banditWeights.findUnique({ where: { userId } });
  return row ? alignWeights(row.weights) : DEFAULT_WEIGHTS;
}

export async function saveWeights(userId: string, weights: number[]): Promise<void> {
  await prisma.banditWeights.upsert({
    where: { userId },
    update: { weights },
    create: { userId, weights },
  });
}

export async function countInteractions(userId: string): Promise<number> {
  return prisma.interaction.count({ where: { userId } });
}

export async function logInteraction(
  userId: string,
  productId: string,
  action: "SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT",
  reward: number
): Promise<void> {
  await prisma.interaction.create({ data: { userId, productId, action, reward } });
}

export async function loadPreferenceProfile(userId: string): Promise<PreferenceProfile> {
  const rows = await prisma.interaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PROFILE_HISTORY_LIMIT,
    select: { productId: true, reward: true, createdAt: true },
  });

  const products = await getProductsByIds(Array.from(new Set(rows.map((r) => r.productId))));
  const byId = new Map(products.map((p) => [p.id, p]));

  // Oldest first, so a later "not interested" correctly overrides an
  // earlier save when building the liked set.
  const observations: Observation[] = [];
  for (const row of rows.reverse()) {
    const product = byId.get(row.productId);
    if (product) observations.push({ product, reward: row.reward, at: row.createdAt });
  }
  return buildProfile(observations);
}
