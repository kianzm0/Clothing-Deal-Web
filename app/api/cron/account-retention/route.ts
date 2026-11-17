import { NextResponse } from "next/server";
import { purgeAccountHistory } from "@/lib/account-lifecycle";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try { return NextResponse.json(await purgeAccountHistory()); }
  catch { return NextResponse.json({ error: "Retention failed." }, { status: 503 }); }
}
