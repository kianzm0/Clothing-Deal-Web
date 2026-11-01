import { AccountInputError, parsePreferences, readAccountJson } from "@/lib/account-input";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getPreferences, savePreferences } from "@/lib/user-data-repository";
import { DEFAULT_PREFERENCES } from "@/lib/types";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ signedIn: false, prefs: DEFAULT_PREFERENCES });

  const prefs = await getPreferences(session.user.id);
  return NextResponse.json({ signedIn: true, prefs });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const prefs = parsePreferences(await readAccountJson(req));
    await savePreferences(session.user.id, prefs);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not save preferences. Please try again." }, { status: 503 });
  }
}
