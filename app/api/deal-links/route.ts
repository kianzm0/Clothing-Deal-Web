import { NextResponse } from "next/server";
import { requireEditorialAccess } from "@/lib/authorization";
import { scavengeProductUrl } from "@/lib/scavenger";
import { publicScavengerError } from "@/lib/scavenger-response";

export async function POST(req: Request) {
  const denied = await requireEditorialAccess();
  if (denied) return denied;

  const { urls } = await req.json().catch(() => ({}));
  const list: string[] = Array.isArray(urls) ? urls : [];
  if (!list.length) return NextResponse.json({ error: "urls must be a non-empty array." }, { status: 400 });

  const results = await Promise.allSettled(list.map((url) => scavengeProductUrl(url)));
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
