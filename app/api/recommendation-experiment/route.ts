import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrCreateAssignment, getActiveExperiment } from "@/lib/experiment-repository";
import { policyVersion } from "@/lib/recommendation-experiment";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ enabled: false }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { evaluationEnabled: true } });
  // Assignment is withheld unless the account has explicitly opted into evaluation.
  if (!user?.evaluationEnabled) return NextResponse.json({ enabled: false, variant: "control" });
  const config = await getActiveExperiment();
  const assignment = await getOrCreateAssignment(session.user.id);
  return NextResponse.json({ enabled: config.enabled, experimentId: assignment.experimentId,
    variant: assignment.variant, policyVersion: policyVersion(assignment.variant, config) },
    { headers: { "Cache-Control": "no-store" } });
}
