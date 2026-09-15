import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getWeights, countInteractions } from "@/lib/bandit-repository";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ signedIn: false }, { status: 200 });
  }

  const [weights, interactionCount] = await Promise.all([
    getWeights(session.user.id),
    countInteractions(session.user.id),
  ]);

  return NextResponse.json({ signedIn: true, weights, interactionCount });
}
