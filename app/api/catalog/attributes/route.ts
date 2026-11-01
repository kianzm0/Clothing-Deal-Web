import { NextResponse } from "next/server";
import { getCatalogAttributes } from "@/lib/repository";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const attributes = await getCatalogAttributes();
    return NextResponse.json(attributes, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "Catalog options are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
