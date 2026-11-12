# Recommendation experiments

The experiment is intentionally inactive after migration. The seeded row has
`enabled=false` and `allocationBps=0`; existing recommendations remain on
`personalized-v2`.

When explicitly approved, a trusted operator may update only the experiment
configuration row:

```sql
UPDATE recommendation_experiments
SET enabled = true, allocationBps = 1000
WHERE id = 'recommendation-policy-v1';
```

`allocationBps` is basis points, so 1000 means a 10% treatment allocation.
Assignments are persisted per account and never move between arms. The
treatment is deterministic and bounded: it starts from the current ranker and
only applies small freshness/discount tie-break adjustments. It is not a
contextual bandit and introduces no per-request randomness.

Evaluation remains opt-in. The endpoint refuses assignment for accounts that
have not enabled evaluation; withdrawal deletes all account impressions and
outcomes as before. Impressions store the trusted experiment ID and variant,
while the server ignores untrusted client arm labels for attribution.

The primary metrics are mature 30-minute save rate and retailer-click rate.
Analysis must use account-level clusters, capped position weighting, confidence
intervals, sample-ratio and telemetry-loss checks, and a predeclared stopping
rule. A raw arm difference is not an uplift claim. Do not enable the row until
the retention job and backup deletion behavior are verified in the target
environment. Rollback is the additive SQL update:

```sql
UPDATE recommendation_experiments
SET enabled = false, allocationBps = 0
WHERE id = 'recommendation-policy-v1';
```
