import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProductById } from "@/lib/repository";
import { trainInteraction } from "@/lib/bandit-repository";
import { InteractionAction } from "@/lib/bandit";

const VALID_ACTIONS: InteractionAction[] = ["SAVE", "UNSAVE", "SKIP", "CLICK_OUT"];

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ trained: false });
  const body = await req.json().catch(() => null);
  const productId = body?.productId;
  const action = body?.action;
  if (typeof productId !== "string" || !productId.trim() || productId.length > 200 || !VALID_ACTIONS.includes(action)) {
    return NextResponse.json({ error: "productId and a valid action are required." }, { status: 400 });
  }
  const product = await getProductById(productId);
  if (!product) return NextResponse.json({ error: "Unknown product." }, { status: 404 });
  // Preferences come from the authenticated account, never a client-supplied
  // training vector. Only supported actions determine reward and strength.
  try {
    return NextResponse.json(await trainInteraction(session.user.id, product, action));
  } catch {
    return NextResponse.json({ error: "Could not update recommendations. Please try again." }, { status: 503 });
  }
}
