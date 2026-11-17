# Recommendation experiments

This implementation supersedes the unmerged drafts #21 and #22. Migrations seed a disabled experiment with zero treatment allocation. The environment switch RECOMMENDATION_EXPERIMENTS_ENABLED also defaults false. Both controls must permit the experiment before accounts can be assigned. No production activation is part of this change.

Eligible accounts must opt into evaluation. Assignment uses an experiment/account hash, persists once under an account row lock, and remains stable across requests and devices. Control and treatment use the same page candidate set and learning policy. Treatment adds at most 0.02 freshness and 0.01 discount score bonus before the existing diversity pass. No per-request randomness or exploration is added. Other sort modes and unready personalization are observational, not experimental exposures.

Impression metadata is checked against the persisted account assignment; client arm claims cannot override it. Stale configuration or wrong arms are rejected. Existing impression retries preserve historical metadata across shutdown. Assignment metadata changes reset the browser view. Clients refresh on focus and every 30 seconds, fall back to control on failure, and clear treatment immediately on local consent withdrawal. Cross-tab withdrawal stops writes on the server immediately; another open tab can take up to 30 seconds to stop showing its old ordering.

Withdrawal deletes impressions, outcomes and assignment. Account deletion cascades all of them. Assignment is retained while participating to preserve stable treatment; disabled experiments' assignments older than 30 days are purged by evaluation retention. The consent copy explains this distinction. Do not change allocation or policy versions during a running analysis; stop and define a new protocol instead.

## Before activation

Verify migration, retention execution, backups/deletion policies, trusted email configuration if using account flows, and error monitoring in the target environment. Freeze the account eligibility, fixed allocation, primary engagement metric, minimum sample size/detectable effect, enrollment window and stopping rule in advance. Confirm no sample-ratio mismatch and comparable exposure coverage. Run the experiment long enough for the predeclared sample; do not repeatedly peek for significance.

With both gates configured and verified, the operator can set enabled=true and allocationBps to a fixed value strictly between 0 and 10000. For rollback set enabled=false; the environment gate provides a second kill switch. No schema rollback is needed. Old exposures remain attributed to their recorded policy.

## Reporting

`npx tsx scripts/experiment-report.ts [fromUTC] [toUTC]` selects an enrollment cohort inside retained history, ending at least 30 minutes ago. It reports assignment counts, exposure coverage per arm, an approximate sample-ratio z check (only when expected counts are sufficient), and equal-account mean save/click rates with approximate normal uncertainty. It refuses oversized cohorts rather than silently truncating. Mixed allocation is flagged. Position is not an inverse propensity estimate and receives no arbitrary weighting.

These are descriptive exposed-account engagement metrics, not intention-to-treat purchase conversion. Unexposed accounts and telemetry failures can cause selection bias. Coverage differences and opt-in selection must accompany any interpretation; use a predeclared account-level primary analysis before claiming causal uplift. Small samples and extreme rates make normal intervals unreliable. No improvement is claimed by this implementation.
