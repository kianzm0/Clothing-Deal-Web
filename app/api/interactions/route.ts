import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProductById } from "@/lib/repository";
import { getWeights, saveWeights, logInteraction, countInteractions } from "@/lib/bandit-repository";
import { featurize, updateWeights, REWARD_BY_ACTION } from "@/lib/bandit";
import { DEFAULT_PREFERENCES, Preferences } from "@/lib/types";

const VALID_ACTIONS = ["SAVE", "UNSAVE", "SKIP", "CLICK_OUT"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    // Signed-out visitors just don't train the bandit — the rule-based
    // score is their whole experience, same as before auth existed.
    return NextResponse.json({ trained: false }, { status: 200 });
  }

  const body = await req.json().catch(() => null);
  const productId: string | undefined = body?.productId;
  const action: Action | undefined = body?.action;
  const prefs: Preferences = body?.prefs ?? DEFAULT_PREFERENCES;

  if (!productId || !action || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "productId and a valid action are required." }, { status: 400 });
  }

  const product = await getProductById(productId);
  if (!product) {
    return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  }

  const userId = session.user.id;
  const reward = REWARD_BY_ACTION[action];
  const features = featurize(product, prefs);

  const currentWeights = await getWeights(userId);
  const nextWeights = updateWeights(currentWeights, features, reward);

  await Promise.all([
    logInteraction(userId, productId, action, reward),
    saveWeights(userId, nextWeights),
  ]);

  const interactionCount = await countInteractions(userId);

  return NextResponse.json({ trained: true, weights: nextWeights, interactionCount });
}
