import { NextResponse } from "next/server";
import { requireEditorialAccess } from "@/lib/authorization";
import { scavengeProductUrl } from "@/lib/scavenger";
import { scavengerErrorResponse } from "@/lib/scavenger-response";

export async function POST(req: Request) {
  const denied = await requireEditorialAccess();
  if (denied) return denied;

  const { url } = await req.json().catch(() => ({}));
  if (!url) return NextResponse.json({ error: "url is required." }, { status: 400 });

  try {
    const deal = await scavengeProductUrl(url);
    return NextResponse.json({ deal });
  } catch (error) {
    return scavengerErrorResponse(error);
  }
}
