import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { AccountInputError, readAccountJson } from "@/lib/account-input";
import { authenticatedAccountAction } from "@/lib/account-lifecycle";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  try {
    const body = await readAccountJson(req, 2048) as Record<string, unknown>;
    if (!body || !["delete", "sessions", "learning"].includes(String(body.action))) throw new AccountInputError("Invalid account action.");
    if (body.action === "delete" && body.confirmation !== "DELETE") throw new AccountInputError("Type DELETE to confirm account deletion.");
    await authenticatedAccountAction(session.user.id, body.password, body.action as "delete" | "sessions" | "learning");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return NextResponse.json({ error: error instanceof AccountInputError ? error.message : "Account service unavailable." }, { status: error instanceof AccountInputError ? error.status : 503 }); }
}
