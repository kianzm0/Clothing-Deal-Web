import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scavengeProductUrl } from "@/lib/scavenger";
import { scavengerErrorResponse } from "@/lib/scavenger-response";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { url } = await req.json().catch(() => ({}));
  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });

  try {
    const deal = await scavengeProductUrl(url);
    return NextResponse.json({ deal });
  } catch (error) {
    return scavengerErrorResponse(error);
  }
}
