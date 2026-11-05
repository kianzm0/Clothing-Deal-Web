import { NextResponse } from "next/server";
import { requireEditorialAccess } from "@/lib/authorization";
import { scavengeProductUrl } from "@/lib/scavenger";
import { DealLinksInputError, readDealLinks, extractDealLinks } from "@/lib/deal-links";
import { publicScavengerError } from "@/lib/scavenger-response";

export async function POST(req: Request) {
  const denied = await requireEditorialAccess();
  if (denied) return denied;

  let list: string[];
  try {
    list = await readDealLinks(req);
  } catch (error) {
    if (error instanceof DealLinksInputError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  const results = await extractDealLinks(list, scavengeProductUrl);
  return NextResponse.json(
    {
      results: results.map((result, index) =>
        result.status === "fulfilled"
          ? { url: list[index], ok: true, deal: result.value }
          : { url: list[index], ok: false, error: publicScavengerError(result.reason) }
      ),
    },
    { status: 207 }
  );
}

