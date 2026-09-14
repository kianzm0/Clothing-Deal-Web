import { prisma } from "./prisma";
import { DEFAULT_WEIGHTS } from "./bandit";

export async function getWeights(userId: string): Promise<number[]> {
  const row = await prisma.banditWeights.findUnique({ where: { userId } });
  return row ? row.weights : DEFAULT_WEIGHTS;
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
