import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { purgeEvaluationHistory } from "@/lib/evaluation-repository";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const result = await purgeEvaluationHistory();
    return NextResponse.json({ deleted: result.count });
  } catch { return NextResponse.json({ error: "Retention cleanup failed" }, { status: 503 }); }
}
