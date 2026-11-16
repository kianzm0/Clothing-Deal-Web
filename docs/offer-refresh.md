# Automated offer refresh

The scheduled endpoint is GET /api/cron/offers. It requires the exact header
Authorization: Bearer $CRON_SECRET; requests without the secret are rejected
before any database or retailer work.

Each run selects only active offers whose lastScannedAt is missing or older
than six hours. The requested batch is clamped to 1–25 offers (default 10), and
only two retailer pages are fetched concurrently. The worker reuses
lib/offer-ingest.ts, so the existing HTTPS, retailer allowlist, redirect,
download-size, timeout, and USD-only checks remain in force.

A successful in-stock refresh keeps the offer active. An out-of-stock or
low-confidence/invalid refresh is moved to needs_review, which the public
repository already excludes. A failed refresh is held for review once the
offer has been stale for at least 24 hours; newer failures remain active for one
more scheduled attempt. Failures are isolated per offer and summarized in the
response/logs.

Before activation:

1. Configure a strong CRON_SECRET in the deployment environment.
2. Apply the cron entry in vercel.json (the proposed entry is shown in the PR).
3. Deploy and verify one authenticated request in the hosting logs.
4. Confirm that an unauthenticated request returns 401.
5. Monitor retailer error rates and editorial review volume before increasing
   the batch or concurrency limits.

This worker changes offer records when it runs. It does not run during build,
does not create products, and does not refresh offers already held for review.