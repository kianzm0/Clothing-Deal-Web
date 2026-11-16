import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { clampRefreshLimit, refreshStaleOffers } from "@/lib/offer-refresh";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return Boolean(secret && provided.length === expected.length && timingSafeEqual(provided, expected));
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const limit = clampRefreshLimit(new URL(req.url).searchParams.get("limit"));
    const result = await refreshStaleOffers(new Date(), limit);
    console.info("[offer-refresh] completed", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("[offer-refresh] batch failed", { reason: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "Offer refresh failed" }, { status: 503 });
  }
}