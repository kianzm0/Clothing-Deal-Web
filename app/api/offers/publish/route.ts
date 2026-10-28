import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestDealForProduct } from "@/lib/offer-ingest";
import { parseReviewOverrides, requireNewProductFields } from "@/lib/review";
import { scavengerErrorResponse } from "@/lib/scavenger-response";
import { scavengeProductUrl } from "@/lib/scavenger";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.url !== "string" || !body.url.trim()) return NextResponse.json({ error: "url is required." }, { status: 400 });
  let overrides;
  try { overrides = parseReviewOverrides(body.overrides); } catch (error) { return NextResponse.json({ error: (error as Error).message }, { status: 400 }); }
  try {
    const preview = await scavengeProductUrl(body.url);
    let productId = typeof body.productId === "string" && body.productId.trim() ? body.productId : undefined;
    if (productId) {
      if (!await prisma.product.findUnique({ where: { id: productId }, select: { id: true } })) return NextResponse.json({ error: "Product not found." }, { status: 404 });
    } else {
      const fields = requireNewProductFields(body.category, preview, overrides);
      productId = crypto.randomUUID();
      await prisma.product.create({ data: { id: productId, name: fields.name, brand: fields.brand, category: fields.category.toUpperCase().replace("-", "_") as "T_SHIRT" | "HOODIE" | "SWEATSHIRT" | "LONG_SLEEVE", colors: overrides.colors ?? [], sizes: overrides.sizes ?? [], image: overrides.imageUrl ?? preview.imageUrl ?? "" } });
    }
    const result = await ingestDealForProduct(productId, body.url, overrides);
    return NextResponse.json({ productId, offer: result.offer, warnings: result.deal.warnings }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error instanceof Error && !("statusCode" in error)) return NextResponse.json({ error: error.message }, { status: 400 });
    return scavengerErrorResponse(error);
  }
}
