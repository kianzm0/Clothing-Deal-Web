import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { AccountInputError, parseSignup, readAccountJson } from "@/lib/account-input";

export async function POST(req: Request) {
  try {
    const { email, password, name } = parseSignup(await readAccountJson(req, 8192));
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({ data: { email, passwordHash, name, role: "USER" } });
    return NextResponse.json({ id: user.id, email: user.email });
  } catch (error) {
    if (error instanceof AccountInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    if ((error as { code?: string })?.code === "P2002") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not create your account. Please try again." }, { status: 503 });
  }
}
