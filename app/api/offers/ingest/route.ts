import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { scavengeProductUrl } from "@/lib/scavenger";
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

  let deal;
  try {
    deal = await scavengeProductUrl(url);
  } catch (error) {
    return scavengerErrorResponse(error);
  }

  const existing = await prisma.offer.findFirst({ where: { productId, url: deal.canonicalUrl } });

  const priceDollars = deal.priceCents !== null ? deal.priceCents / 100 : existing?.price ?? 0;
  const originalPriceDollars =
    deal.listPriceCents !== null ? deal.listPriceCents / 100 : existing?.originalPrice ?? priceDollars;

  const data = {
    store: deal.retailerName,
    price: priceDollars,
    originalPrice: originalPriceDollars,
    shippingCost: existing?.shippingCost ?? 0,
    sizesInStock: existing?.sizesInStock ?? [],
    lastUpdated: new Date(deal.fetchedAt),
    url: deal.canonicalUrl,
    sourceUrl: deal.sourceUrl,
    retailerDomain: deal.retailerDomain,
    availability: deal.availability,
    status: deal.status,
    confidence: deal.confidence,
    extractionSources: deal.extractionSources,
    lastScannedAt: new Date(deal.fetchedAt),
  };

  const offer = existing
    ? await prisma.offer.update({ where: { id: existing.id }, data })
    : await prisma.offer.create({ data: { ...data, productId } });

  return NextResponse.json({ offer, warnings: deal.warnings }, { status: existing ? 200 : 201 });
}
