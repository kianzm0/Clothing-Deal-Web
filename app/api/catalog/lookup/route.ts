import { NextResponse } from "next/server";
import { AccountInputError, readAccountJson } from "@/lib/account-input";
import { getProductsByIds } from "@/lib/repository";
export async function POST(req: Request) {
  try {
    const body = await readAccountJson(req, 24000) as { ids?: unknown };
    if (!body || !Array.isArray(body.ids) || body.ids.length > 100 || body.ids.some(id => typeof id !== "string" || !id || id.length > 200)) throw new AccountInputError("Provide at most 100 product IDs.");
    return NextResponse.json({ products: await getProductsByIds([...new Set(body.ids as string[])]) });
  } catch (e) { return NextResponse.json({ error: e instanceof AccountInputError ? e.message : "Catalog unavailable." }, { status: e instanceof AccountInputError ? e.status : 503 }); }
}
