import { prisma } from "../lib/prisma";
import { ATTRIBUTION_MS, RETENTION_MS } from "../lib/evaluation";
import { compareExperiment, EXPERIMENT_ID, ExperimentObservation, sampleRatioCheck } from "../lib/recommendation-experiment";
async function main() {
  const now = Date.now(), to = new Date(process.argv[3] ?? now - ATTRIBUTION_MS), from = new Date(process.argv[2] ?? to.getTime() - 7 * 86400000);
  if (!Number.isFinite(+from) || !Number.isFinite(+to) || +from >= +to || +to > now - ATTRIBUTION_MS || +from < now - RETENTION_MS) throw new Error("Use a valid retained, mature [from,to) UTC enrollment cohort.");
  const assignments = await prisma.recommendationAssignment.findMany({ where: { experimentId: EXPERIMENT_ID, assignedAt: { gte: from, lt: to } }, take: 100001 });
  if (assignments.length > 100000) throw new Error("Cohort too large; narrow the window.");
  const observations: ExperimentObservation[] = [];
  let cursor = "";
  do {
    const rows = await prisma.recommendationImpression.findMany({ where: { experimentId: EXPERIMENT_ID, id: { gt: cursor }, createdAt: { gte: from, lt: to } }, include: { outcomes: true }, orderBy: { id: "asc" }, take: 1000 });
    if (!rows.length) break;
    for (const row of rows) {
      const valid = (action: string) => row.outcomes.some(o => o.action === action && +o.createdAt >= +row.createdAt && +o.createdAt <= +row.createdAt + ATTRIBUTION_MS);
      if (row.experimentVariant === "control" || row.experimentVariant === "bounded-novelty-v1") observations.push({ userId: row.userId, variant: row.experimentVariant, position: row.position, save: valid("SAVE"), retailerClick: valid("CLICK_OUT") });
    }
    if (observations.length > 200000) throw new Error("Too many observations; narrow the window.");
    cursor = rows[rows.length-1].id;
  } while (true);
  const byUser = new Map(assignments.map(a => [a.userId, a]));
  const cohort = observations.filter(o => byUser.get(o.userId)?.variant === o.variant);
  const allocations = [...new Set(assignments.map(a => a.allocationBps))];
  const checks = allocations.map(allocationBps => {
    const selected = assignments.filter(a => a.allocationBps === allocationBps);
    const control = selected.filter(a => a.variant === "control").length, treatment = selected.filter(a => a.variant === "bounded-novelty-v1").length;
    return { allocationBps, control, treatment, ...sampleRatioCheck(control, treatment, allocationBps) };
  });
  const coverage = ["control", "bounded-novelty-v1"].map(variant => ({ variant, assigned: assignments.filter(a => a.variant === variant).length,
    exposed: new Set(cohort.filter(o => o.variant === variant).map(o => o.userId)).size }));
  console.log(JSON.stringify({ from, to, experimentId: EXPERIMENT_ID, coverage, sampleRatio: checks,
    mixedAllocationWarning: allocations.length > 1, metrics: compareExperiment(cohort),
    interpretation: "Descriptive exposed-account engagement rates with approximate normal intervals. Exposure coverage can differ by arm. Not an intention-to-treat purchase-conversion estimate. Predeclare sample size and stopping; do not repeatedly peek for significance." }, null, 2));
}
main().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
