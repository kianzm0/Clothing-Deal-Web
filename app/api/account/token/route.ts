import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AccountInputError, readAccountJson } from "@/lib/account-input";
import { consumeAccountToken, requestAccountToken } from "@/lib/account-lifecycle";
export async function POST(req: Request) {
  if (req.headers.get("origin") !== new URL(req.url).origin) return NextResponse.json({ error: "Invalid origin." }, { status: 403 });
  try {
    const body = await readAccountJson(req, 2048) as Record<string, unknown>;
    if (!body || !["reset", "verify"].includes(String(body.purpose))) throw new AccountInputError("Invalid request.");
    const purpose = body.purpose as "reset" | "verify";
    if (typeof body.token === "string") {
      await consumeAccountToken(body.token, purpose, body.password);
      return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
    }
    let email: string;
    if (purpose === "verify") {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id) throw new AccountInputError("Sign in required.", 401);
      const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
      if (!user) throw new AccountInputError("Sign in required.", 401);
      email = user.email;
    } else {
      if (typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim())) throw new AccountInputError("Valid email required.");
      email = body.email.trim().toLowerCase();
    }
    await requestAccountToken(email, purpose);
    return NextResponse.json({ message: "If this account is eligible, an email will arrive shortly." }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof AccountInputError ? error.message : "Account service unavailable." }, { status: error instanceof AccountInputError ? error.status : 503 });
  }
}
