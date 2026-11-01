import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ACTIONS, parseExposure, validExposureId } from "@/lib/evaluation";
import { recordExposure, recordEvaluationOutcome, setEvaluationConsent } from "@/lib/evaluation-repository";

export const dynamic = "force-dynamic";
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ enabled: false }, 401);
  try {
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { evaluationEnabled: true } });
    return json({ enabled: user?.evaluationEnabled ?? false });
  } catch { return json({ error: "Evaluation unavailable." }, 503); }
}
export async function POST(req: Request) {
  // All writes require a same-origin browser request; no cross-site consent changes.
  if (req.headers.get("origin") !== new URL(req.url).origin) return json({ error: "Invalid origin." }, 403);
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return json({ error: "Sign in required." }, 401);
  if (!req.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON required." }, 415);
  // Bound streamed bodies as well as declared Content-Length.
  const reader = req.body?.getReader();
  if (!reader) return json({ error: "Body required." }, 400);
  let text = "", bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 4096) { await reader.cancel(); return json({ error: "Body too large." }, 413); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch { return json({ error: "Invalid body." }, 400); }
  let body;
  try { body = JSON.parse(text); } catch { return json({ error: "Invalid JSON." }, 400); }
  try {
    if (body?.type === "consent" && typeof body.enabled === "boolean") {
      await setEvaluationConsent(session.user.id, body.enabled);
      return json({ enabled: body.enabled });
    }
    if (body?.type === "impression") {
      const exposure = parseExposure(body.exposure);
      if (!exposure) return json({ error: "Invalid impression." }, 400);
      const result = await recordExposure(session.user.id, exposure);
      return json(result, result.status);
    }
    if (body?.type === "outcome" && validExposureId(body.impressionId) && typeof body.productId === "string" &&
      body.productId.length > 0 && body.productId.length <= 200 && ACTIONS.includes(body.action)) {
      const result = await recordEvaluationOutcome(session.user.id, body.impressionId, body.productId, body.action);
      return json(result, result.status);
    }
    return json({ error: "Invalid evaluation event." }, 400);
  } catch { return json({ error: "Evaluation unavailable." }, 503); }
}
