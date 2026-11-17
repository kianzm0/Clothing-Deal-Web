import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return new Response("Sign in required", { status: 401 });
  const userId = session.user.id;
  const at = new Date();
  async function* records() {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true, createdAt: true, emailVerifiedAt: true, evaluationEnabled: true } });
    yield { section: "account", data: user, exportedAt: at };
    yield { section: "preferences", data: await prisma.preference.findUnique({ where: { userId } }) };
    yield { section: "weights", data: await prisma.banditWeights.findUnique({ where: { userId } }) };
    yield { section: "experiments", data: await prisma.recommendationAssignment.findMany({ where: { userId } }) };
    let cursor = "";
    do {
      const rows = await prisma.watchlistItem.findMany({ where: { userId, productId: { gt: cursor }, createdAt: { lte: at } }, orderBy: { productId: "asc" }, take: 200 });
      if (!rows.length) break;
      for (const row of rows) yield { section: "watchlist", data: row };
      cursor = rows[rows.length - 1].productId;
    } while (!req.signal.aborted);
    cursor = "";
    do {
      const rows = await prisma.interaction.findMany({ where: { userId, id: { gt: cursor }, createdAt: { lte: at } }, orderBy: { id: "asc" }, take: 200 });
      if (!rows.length) break;
      for (const row of rows) yield { section: "interactions", data: row };
      cursor = rows[rows.length - 1].id;
    } while (!req.signal.aborted);
    cursor = "";
    do {
      const rows = await prisma.recommendationImpression.findMany({ where: { userId, id: { gt: cursor }, createdAt: { lte: at } }, include: { outcomes: true }, orderBy: { id: "asc" }, take: 200 });
      if (!rows.length) break;
      for (const row of rows) yield { section: "evaluation", data: row };
      cursor = rows[rows.length - 1].id;
    } while (!req.signal.aborted);
    yield { section: "complete", exportedAt: at };
  }
  const iterator = records(), encoder = new TextEncoder();
  return new Response(new ReadableStream({
    async pull(controller) {
      try {
        if (req.signal.aborted) { await iterator.return(undefined); controller.close(); return; }
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(encoder.encode(JSON.stringify(next.value) + "\n"));
      } catch (error) { controller.error(error); }
    },
    async cancel() { await iterator.return(undefined); },
  }), { headers: { "Content-Type": "application/x-ndjson", "Content-Disposition": 'attachment; filename="threadscout-account.ndjson"', "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
