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

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  await addToWatchlist(session.user.id, productId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { productId } = await req.json().catch(() => ({}));
  if (!productId) return NextResponse.json({ error: "productId is required." }, { status: 400 });

  await removeFromWatchlist(session.user.id, productId);
  return NextResponse.json({ ok: true });
}
