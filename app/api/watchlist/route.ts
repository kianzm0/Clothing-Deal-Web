import { AccountInputError, parseProductId, readAccountJson } from "@/lib/account-input";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { addToWatchlist, getWatchlistIds, removeFromWatchlist } from "@/lib/user-data-repository";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ signedIn: false, ids: [] });

  const ids = await getWatchlistIds(session.user.id);
  return NextResponse.json({ signedIn: true, ids });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const productId = parseProductId(await readAccountJson(req, 1024));
    await addToWatchlist(session.user.id, productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update watchlist. Please try again." }, { status: 503 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  try {
    const productId = parseProductId(await readAccountJson(req, 1024));
    await removeFromWatchlist(session.user.id, productId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AccountInputError) return NextResponse.json({ error: error.message }, { status: error.status });
    return NextResponse.json({ error: "Could not update watchlist. Please try again." }, { status: 503 });
  }
}

