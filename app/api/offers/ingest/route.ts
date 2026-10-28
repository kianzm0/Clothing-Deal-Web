import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestDealForProduct } from "@/lib/offer-ingest";
import { scavengerErrorResponse } from "@/lib/scavenger-response";

// Turns a scavenged product link into a real Offer on an existing
// Product. Re-fetches server-side (never trusts a client-supplied
// deal payload) and upserts by (productId, canonicalUrl) so
// re-submitting the same link refreshes price/availability instead
// of creating a duplicate row — this is the rescan path too.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { productId, url } = await req.json().catch(() => ({}));
  if (!productId || !url) {
    return NextResponse.json({ error: "productId and url are required." }, { status: 400 });
  }

  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) return NextResponse.json({ error: "Product not found." }, { status: 404 });

  try {
    const result = await ingestDealForProduct(productId, url);
    return NextResponse.json({ offer: result.offer, warnings: result.deal.warnings }, { status: result.created ? 201 : 200 });
  } catch (error) {
    return scavengerErrorResponse(error);
  }
}
