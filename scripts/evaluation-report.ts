import { prisma } from "../lib/prisma";
import { ATTRIBUTION_MS, RETENTION_MS, evaluationMetrics } from "../lib/evaluation";

async function main() {
  const asOf = new Date();
  const from = new Date(process.argv[2] ?? asOf.getTime() - 7 * 86400000);
  const to = new Date(process.argv[3] ?? asOf.getTime() - ATTRIBUTION_MS);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || from >= to || +from < +asOf - RETENTION_MS || +to > +asOf - ATTRIBUTION_MS) {
    throw new Error("Use a mature [from,to) UTC cohort within the last 30 days; end at least 30 minutes ago.");
  }
  const groups = new Map<string, ReturnType<typeof evaluationMetrics>>();
  let cursor: string | undefined;
  // Page through retained records without exporting account IDs or event-level data.
  while (true) {
    const rows = await prisma.recommendationImpression.findMany({
      where: { createdAt: { gte: from, lt: to } }, orderBy: { id: "asc" }, take: 1000,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: { id: true, createdAt: true, rankingVersion: true, sort: true, position: true, filtered: true, personalized: true,
        outcomes: { select: { action: true, createdAt: true } } },
    });
    if (!rows.length) break;
    for (const row of rows) {
      const key = JSON.stringify({ version: row.rankingVersion, sort: row.sort, position: row.position, filtered: row.filtered, personalized: row.personalized });
      const m = evaluationMetrics([row], asOf), prev = groups.get(key);
      if (prev) for (const field of ["impressions", "pendingImpressions", "saves", "retailerClicks", "skips", "unsaves"] as const) m[field] += prev[field];
      groups.set(key, m);
    }
    cursor = rows[rows.length - 1].id;
  }
  console.log(JSON.stringify({ from, to, asOf, attributionMinutes: 30, groups: [...groups].map(([key, m]) => ({ ...JSON.parse(key), ...m,
    saveRate: m.impressions ? m.saves / m.impressions : null,
    retailerClickRate: m.impressions ? m.retailerClicks / m.impressions : null,
    skipRate: m.impressions ? m.skips / m.impressions : null, unsaveRate: m.impressions ? m.unsaves / m.impressions : null })) }, null, 2));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; }).finally(() => prisma.$disconnect());
