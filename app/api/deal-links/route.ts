import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { scavengeProductUrl } from "@/lib/scavenger";
import { publicScavengerError } from "@/lib/scavenger-response";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

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
