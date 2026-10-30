import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_WEIGHTS, alignWeights, featurize, InteractionAction, REWARD_BY_ACTION, STRENGTH_BY_ACTION, updateWeights } from "./bandit";
import { getProductsByIds } from "./repository";
import { Observation, PreferenceProfile, buildProfile } from "./preference-model";
import { DEFAULT_PREFERENCES, Product } from "./types";

const PROFILE_HISTORY_LIMIT = 300;
type Database = Pick<Prisma.TransactionClient, "banditWeights" | "interaction" | "preference">;

export async function getWeights(userId: string, db: Database = prisma): Promise<number[]> {
  const row = await db.banditWeights.findUnique({ where: { userId } });
  return row ? alignWeights(row.weights) : [...DEFAULT_WEIGHTS];
}

export async function countInteractions(userId: string, db: Database = prisma): Promise<number> {
  return db.interaction.count({ where: { userId } });
}

export async function loadPreferenceProfile(userId: string, db: Database = prisma): Promise<PreferenceProfile> {
  const rows = await db.interaction.findMany({
    where: { userId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: PROFILE_HISTORY_LIMIT,
    select: { productId: true, reward: true, action: true, createdAt: true },
  });
  const products = await getProductsByIds(Array.from(new Set(rows.map(r => r.productId))));
  const byId = new Map(products.map(p => [p.id, p]));
  const observations: Observation[] = [];
  for (const row of rows.reverse()) {
    const product = byId.get(row.productId);
    // Interpret existing events under the current action policy as well.
    if (product) observations.push({ product, action: row.action, reward: REWARD_BY_ACTION[row.action], at: row.createdAt });
  }
  return buildProfile(observations);
}

// A serializable transaction keeps the event and model update together.
// Retry write conflicts so feedback from two tabs cannot overwrite a step.
export async function trainInteraction(userId: string, product: Product, action: InteractionAction) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const [weights, profileBefore, storedPrefs, latest, recentCount] = await Promise.all([
          getWeights(userId, tx), loadPreferenceProfile(userId, tx),
          tx.preference.findUnique({ where: { userId } }),
          tx.interaction.findFirst({ where: { userId, productId: product.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }),
          tx.interaction.count({ where: { userId, productId: product.id, createdAt: { gte: new Date(Date.now() - 86400000) } } }),
        ]);
        // A repeated action on the same item within a day is not new evidence.
        const duplicate = latest?.action === action && Date.now() - latest.createdAt.getTime() < 86400000;
        let nextWeights = weights;
        if (!duplicate) {
          // Cap gradient steps per product/day; state-changing feedback still
          // reaches the profile, including a later skip or unsave.
          if (recentCount < 3) {
            nextWeights = updateWeights(weights, featurize(product, storedPrefs ?? DEFAULT_PREFERENCES, profileBefore),
              REWARD_BY_ACTION[action], STRENGTH_BY_ACTION[action]);
          }
          await tx.interaction.create({ data: { userId, productId: product.id, action, reward: REWARD_BY_ACTION[action] } });
          await tx.banditWeights.upsert({ where: { userId }, update: { weights: nextWeights }, create: { userId, weights: nextWeights } });
        }
        const [interactionCount, profile] = await Promise.all([countInteractions(userId, tx), loadPreferenceProfile(userId, tx)]);
        return { trained: true, weights: nextWeights, interactionCount, profile, duplicate };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) {
      if (!["P2034", "P2002"].includes((error as { code?: string }).code ?? "") || attempt === 4) throw error;
    }
  }
  throw new Error("Unable to update recommendations");
}
