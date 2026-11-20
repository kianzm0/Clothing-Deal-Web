import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { accountExperiment, noExperiment } from "@/lib/experiment-repository";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await getServerSession(authOptions);
  const headers = { "Cache-Control": "no-store" };
  if (!session?.user?.id) return NextResponse.json(noExperiment, { headers });
  try { return NextResponse.json(await accountExperiment(session.user.id), { headers }); }
  catch { return NextResponse.json(noExperiment, { status: 503, headers }); }
}
