# ThreadScout — Phase 2 (Next.js + TypeScript)

Rebuild of the static MVP from your original repo, using the exact
architecture your own README called for. No behavior changed, no
placeholder pages — every feature from the static version works
here, typed and componentized.

## Run it

```
npm install
npm run dev
```

Open http://localhost:3000

## Editorial permissions and deployment

Accounts have a database `UserRole`: `USER` (customer), `EDITOR`, or `ADMIN`.
Only editors and administrators may use `/review` or POST to `/api/scavenge`,
`/api/deal-links`, `/api/offers/ingest`, and `/api/offers/publish`. These APIs
return 401 for visitors, 403 for accounts without editorial access (including
deleted accounts), and 503 if permissions cannot be verified. Checks run before
body parsing, retailer requests, or catalog operations. The review page redirects
visitors to sign in and returns not-found for customers before loading products.

The navigation role is refreshed from the database when the session is loaded.
Each editorial request independently checks the current database role, so revoking
access blocks the next request even with an old session or a stale navigation link.
Client role fields, session updates, and JWT role claims do not grant access.
Preference writes allow only preference fields, blocking nested Prisma relation
writes that could otherwise be used to alter a user's role.
Browsing, signup, watchlists, preferences, and recommendation learning remain
available under their existing rules. `ADMIN` currently has the same catalog
permissions as `EDITOR`; neither role can grant roles through a web endpoint.

### Apply the schema before deploying the application

This repository previously had no committed migrations. `0_baseline` represents
the schema before roles; `20261029000000_editorial_roles` adds the role column with
a `USER` default. **No existing account is automatically promoted.**

For a **new, empty database**, run `npx prisma migrate deploy`, then
`npx prisma generate`. For an **existing database**, back it up and first inspect:

```bash
npx prisma migrate status
npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script
```

The schema difference must contain only the new `UserRole` enum and `users.role`
column. Reconcile any other drift or locally maintained migration history before
proceeding. On a database matching the pre-role schema, mark only the baseline as
already applied, then apply the additive role migration:

```bash
npx prisma migrate resolve --applied 0_baseline
npx prisma migrate deploy
npx prisma generate
npm run build
```

Do not run the baseline SQL over existing tables, reset production, or mark the
role migration as applied without executing it. These instructions supersede the
historical Phase 3–6 migration setup below. Baseline guidance:
[Prisma Migrate documentation](https://www.prisma.io/docs/orm/v6/prisma-migrate/getting-started#adding-prisma-migrate-to-an-existing-project).

### Grant or revoke editorial access

A trusted operator with database credentials must verify the intended person's
existing account and immutable user ID (for example in Prisma Studio). Run the
following from a trusted checkout with `DATABASE_URL` set for the intended
environment; these commands never run automatically during signup, seeding,
installation, or deployment:

```bash
npm run user:role -- --user-id <verified-user-id> --role EDITOR
npm run user:role -- --user-id <verified-user-id> --role ADMIN
npm run user:role -- --user-id <verified-user-id> --role USER
```

Use one command for the desired role; `USER` revokes editorial access. The command
requires an explicit ID and valid role, changes only that existing account, fails
for unknown IDs, and prints a timestamped before/after record for the operator's
audit log. It does not create accounts or match emails/domains automatically.
Keep database credentials restricted to trusted operators. Refresh the browser
session to update navigation after a grant or revocation.

### Authorization verification

`npm test` runs the real route handlers and permission helper with mocked session,
database, and retailer-network boundaries. Coverage includes visitors, customers,
editors, administrators, stale/spoofed roles, deleted accounts, permission-store
failures, role revocation, signup, review-page access, navigation, and customer
features. `npm run typecheck` checks the generated Prisma and application types.

The authorization GitHub Actions workflow also tests migration of an existing
customer account and explicit grant/revocation commands against disposable
Postgres, checks schema drift, applies migrations to an empty schema, and runs
the production build. No tests target the deployed application or its database.

## What changed vs. the static MVP

- All data flows through `lib/repository.ts`. That is the ONLY file
  you touch when you plug in Postgres (Prisma/Drizzle) — pages call
  `getAllProducts()` / `getProductById()`, never the raw array.
- `lib/store.ts` holds the watchlist + preferences hooks. Same
  localStorage approach as before, but typed, and structured so a
  server-backed version (once you add Supabase/Clerk/Auth.js) can
  replace the internals without touching any component.
- `lib/recommend.ts` is your rule-based scoring, ported 1:1.
- `lib/pricing.ts` centralizes "best offer", discount %, and
  freshness math that both the browse grid and the detail page use.

## File map

- `app/page.tsx` — browse/search/filter/sort (was index.html)
- `app/product/[id]/page.tsx` — offer comparison table
- `app/watchlist/page.tsx` — saved items
- `app/preferences/page.tsx` — size/brand/color/budget/discount prefs
- `lib/data.ts` — seeded catalog (swap target for Phase 3 DB work)
- `lib/repository.ts` — the data-access seam for Phase 3
- `lib/types.ts`, `lib/pricing.ts`, `lib/recommend.ts`, `lib/store.ts`

## Phase 3: Postgres + Prisma (done)

`lib/repository.ts` now queries Postgres through Prisma instead of
the in-memory array in `lib/data.ts`. That file still exists — it's
only used by `prisma/seed.ts` now, to populate the database.

### Setup

1. Get a Postgres instance. Fastest options: a free one on
   [Neon](https://neon.tech) or [Supabase](https://supabase.com), or
   `docker run -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres`
   locally.
2. Copy `.env.example` to `.env` and set `DATABASE_URL` to your
   connection string.
3. `npx prisma generate` — generates the typed client `lib/prisma.ts`
   imports from. Do this before `npm run dev` or `npm run build`,
   and again any time you edit `prisma/schema.prisma`.
4. `npx prisma migrate dev --name init` — creates the `products` and
   `offers` tables.
5. `npx tsx prisma/seed.ts` — loads the demo catalog into the DB.
6. `npm run dev` — the site now reads from Postgres.

## Phase 4: Auth (done)

Email/password auth via NextAuth v4 (Auth.js), Credentials provider,
JWT sessions — no third-party auth service or OAuth app registration
needed. A `User` model was added to `prisma/schema.prisma`.

### Setup (in addition to the Phase 3 steps)

1. Add to `.env`: `NEXTAUTH_SECRET` (generate with
   `openssl rand -base64 32`) and `NEXTAUTH_URL="http://localhost:3000"`.
2. Run `npx prisma migrate dev --name add_users` to create the
   `users` table.
3. Visit `/signup` to create an account, or `/login` to sign in.
   The nav bar shows your email and a sign-out link once authenticated.

### What's NOT done yet

Watchlist and preferences are still per-browser (localStorage), not
per-account — signing in doesn't yet move your saved items to the
database. That's the natural next step now that `User` exists: add
`Watchlist` and `Preference` tables tied to `userId`, and swap
`lib/store.ts`'s localStorage calls for API routes that check the
session. Worth doing before real offer feeds, since "my saved
deals" is more valuable once it follows the user across devices.

## Recommendations (revamped October 2026)

Best match uses a lightweight online logistic ranker with time-decayed content
preferences. It runs on the existing Next.js/Postgres stack; no external ML
service, API key, GPU, or new database migration is required.

### Ranking and learning

- `lib/bandit.ts` scores 11 features: favorite/disliked brands, colors, in-stock
  sizes, discount, continuous budget fit including shipping, learned attribute
  affinity, similarity to liked items, offer freshness, discount preference,
  and bias. Existing weights retain their positions; missing features receive
  default priors. Non-finite weights are repaired and updates are bounded.
- `lib/ranking.ts` computes stable scores and applies a small brand/category
  repetition penalty across the first 24 results. Ties resolve by product ID.
  There is no random jitter inside the sort comparator. Signed-out visitors
  use the same ranker with default weights and their explicit preferences.
- `lib/recommendation-offer.ts` selects the cheapest eligible offer including
  shipping, preferring an offer stocking a selected size. Sold-out, invalid,
  and review-only offers are excluded from browse results. Product cards,
  filters, and manual sorts use this same offer selection.
- Each Best match card explains up to two relevant factors, such as size
  availability, activity-based similarity, or budget including shipping.
- Saves have target 1 and full training strength; skips target 0 and full
  strength. Retailer clicks have target 0.75 and half strength; unsaves target
  0.5 and quarter strength. Scores express relative ranking preference, not
  calibrated purchase probabilities. Unclicked items are not negative labels.
- Training reads preferences from the authenticated account. A serializable
  transaction writes the event and weights together, retrying conflicts.
  A repeated identical latest action on a product within 24 hours is ignored;
  gradient updates are capped at three per product in a rolling 24 hours.
  Later state changes still reach the preference profile.
- The client queues feedback in order, rejects stale responses, and resets
  model state when the signed-in account changes. `/api/interactions` returns
  the updated profile and weights for reranking after the server responds.

### Preference memory

The last 300 events are reduced to one current observation per product.
Repeated clicks and save toggles therefore cannot inflate the attribute model's
confidence. Explicit saves/skips/unsaves take precedence over subsequent casual
clicks in this history. A skip hides that product from browsing until superseded
by a save or until it leaves the bounded history. An unsave removes its positive
similarity contribution without implying a strong dislike.

Both attribute evidence and item similarity use a 30-day half-life. Attribute
families receive equal weight so products with many listed colors do not drown
out brand/category/price evidence. Learned preferences remain visible and
confirmable on the Preferences page.

### Validation and limitations

`npm test` covers stable ordering, held-out related-item ranking, diversity,
feedback reversals, duplicate evidence, shipping/stock handling, numeric
stability, API validation and transaction retries. CI also runs
`scripts/test-recommendations.ts` against disposable Postgres to verify
concurrent duplicate suppression and distinct feedback updates, plus the full
typecheck and production build.

These are behavioral regression checks with synthetic fixtures, not evidence
of higher real-world conversion. Opt-in impression instrumentation is now available
(see Recommendation evaluation below); production evaluation still needs actual
consented data and a valid experiment or temporal held-out dataset.
There is no cross-user collaborative filtering or purchase tracking. Historical
product features are reconstructed from the current catalog; the profile is
bounded to 300 events, and prior online weights are retained. Diversity is a
small deterministic serving rule, not a learned exploration policy.

## Phase 6: Watchlist + preferences on real accounts (done)

Closes the gap flagged back in Phase 4. Signed-in users now get
`WatchlistItem` and `Preference` rows in Postgres instead of
localStorage — saved items and preferences follow you across
devices and browsers.

**Signed-out behavior is unchanged** — still pure localStorage,
exactly like Phase 1.

**The transition moment is handled, not ignored:** if you built up a
watchlist or set preferences before creating an account, signing in
triggers a one-time migration (`lib/store.ts`) that pushes whatever
was local up to your new account, rather than silently discarding
it. After that, the server is the source of truth and localStorage
just acts as an instant-read cache.

### Setup

One more migration after Phase 5's:
`npx prisma migrate dev --name add_user_data`

## Phase 7: Deal link scavenger (done)

An editor can paste a retailer product URL and get back a normalized,
structured deal candidate — title, brand, image, price, list price,
discount %, availability, SKU — instead of typing offer fields in by
hand.

- `lib/retailers.ts` — the allowlist of ingestible retailers (every
  store already sold on this site, per `lib/data.ts`, plus the
  general clothing retailers from the original plan) and URL
  normalization that strips tracking params (`utm_*`, `gclid`,
  `fbclid`, affiliate click IDs, …) before a link is stored.
- `lib/scavenger.ts` — fetches the product page and extracts fields
  from Schema.org JSON-LD first, then OpenGraph/meta tags, then raw
  HTML price patterns as a last resort. Scores a 0–1 confidence and
  marks anything below 0.7, or missing a price, as `needs_review`
  instead of `active`.
- `POST /api/scavenge` — `{ url }` → one deal candidate, for a
  preview/review screen before anything is saved.
- `POST /api/deal-links` — `{ urls: string[] }` → per-link
  success/error results (HTTP 207), for pasting in a batch.
- `POST /api/offers/ingest` — `{ productId, url }` → re-scrapes
  server-side (never trusts a client-supplied candidate) and
  upserts an `Offer` on that product, keyed by `(productId,
  canonicalUrl)`. Re-submitting the same link refreshes price and
  availability instead of duplicating — this doubles as the rescan
  path.
- `needs_review` offers are held back from `getAllProducts()` /
  `getProductById()` in `lib/repository.ts`, so an incomplete
  extraction can never surface as a live, clickable deal on its own.

### Honest limitations

- **This does scrape retailer pages**, which the note this section
  replaces called out as ToS risk — worth knowing before pointing it
  at retailers in production. It identifies itself with a descriptive
  user agent and only targets an explicit allowlist, but many large
  retailers (Nike, Target, Walmart, Amazon) run bot detection that
  will block or CAPTCHA a server-side fetch like this outright. Treat
  it as a starting point for smaller/DTC retailer sites and an
  editorial paste-a-link workflow, not a scheduled scraper aimed at
  major chains — the honest fix for those is still an affiliate feed
  or retailer API, per the original plan.
- **Review screen is now available at `/review`.** Signed-in editors
  can inspect extracted fields, confidence warnings, and the source
  page; correct the name, brand, or prices; choose a category for a
  new product; and approve publication either by creating a product
  or attaching the offer to an existing product. The publish route
  re-fetches the URL server-side and shares the same ingestion service
  as `POST /api/offers/ingest`.
- **No scheduled re-scan.** `POST /api/offers/ingest` refreshes an
  offer on demand, but nothing calls it on a timer yet — see item 2
  below.

## Phase 8: Learning implicit preferences (done)

Before this, every feature the bandit could weigh came from the
explicit preferences form. Someone who never listed Nike as a
favorite but saved every Nike hoodie they saw would never get more
Nike hoodies — the model had no feature that could notice.
`lib/preference-model.ts` adds a model that learns from what users
actually do, not just what they typed in.

### How it works

- Every product becomes a set of attribute tokens: brand, category,
  each color, and a price band.
- **Per-attribute affinities (Beta-Bernoulli).** Each token keeps a
  time-decayed tally of positive vs. negative reward from the
  `Interaction` log. The posterior mean with a Beta(1, 1) prior means
  one saved product barely moves an affinity and ten distinct products move it a lot. Activity
  has a 30-day half-life, so tastes can change over time.
- **Item-to-item similarity (content-based kNN).** The highest cosine
  similarity between a product and the items the user liked. This
  picks up combinations ("black Nike hoodies") that separate
  per-token affinities miss. Similarity is decay-weighted. A later "Not interested" or unsave removes an item
  from the liked set.
- Both are two new bandit features, `learnedAffinity` and
  `similarToLiked`. Existing users' stored weights are padded with
  the prior for the new features (`alignWeights`), not reset.
- The profile is rebuilt from the last 300 interactions on the
  server and returned by `/api/bandit-weights` and
  `/api/interactions`, so the client re-ranks right away.
- **Visible and editable:** the preferences page has a "Learned from
  your activity" panel that shows what the model picked up and offers
  one-click suggestions: add a favorite or disliked brand, add a
  color, or set a budget based on what you actually saved.

No migration needed. It reads the existing `interactions` table.

### Honest limitations

- Content-based only: it learns from item attributes, not from other
  users (no collaborative filtering). That's the right call at this
  traffic level, but "people who saved X also saved Y" would need
  real cross-user volume.
- Behavioral regression tests exist; production ranking quality still needs measured evaluation.

## Next up (Phase 9+, per your original roadmap)

1. A review screen for scavenged candidates (`warnings` + `confidence`
   already come back from the API; needs a UI plus a "create new
   product" path with a category picker)
2. Background jobs to re-run `/api/offers/ingest` on a schedule and
   move stale/missing/out-of-stock offers to `needs_review` or a new
   `expired` status
3. Offline evaluation for the bandit (compare save-through rate vs. the old rule-based sort)


### Recommendation evaluation (opt-in instrumentation)

This adds measurement, **not evidence of improved conversion**. The ranking policy,
feedback rewards, training history and recommendation order are unchanged. Impressions
never become implicit negative training examples. Evaluation events are separate from
`interactions`, whose existing deduplication is for training rather than measurement.

**Consent and privacy.** Signed-in users can opt in using the Browse checkbox; all
accounts default off. Guests produce no evaluation events. Turning off the checkbox
(or using “Turn off and delete evaluation history”) deletes that account's impressions
and outcomes. Account deletion cascades too. The API checks consent on every write;
a row lock serializes writes with withdrawal across tabs. Existing preference-learning
history is unaffected. No IPs, user agents, referrers, retailer URLs, raw filter values,
sizes, preference vectors or experiment fingerprints are stored by this instrumentation.
Events do contain the existing account ID (pseudonymous, **not anonymous**), product ID,
random view/event IDs, one-based position, result count, sort, a filtered flag,
personalization-ready flag, displayed total price, server-assigned ranking version and
server receipt time. Infrastructure access logs are outside this application's controls
and require a separate retention/privacy review.

**Impression definition.** On Browse only, at least 50% of the actual product card must
intersect the viewport for one uninterrupted second while the document is visible.
Scrolling out, hiding the tab, changing the result set or unmounting cancels dwell.
A DOM render alone, a below-fold card, or a hidden placeholder is not an impression.
This is a viewport visibility proxy; it cannot establish eye attention or detect every
occluding overlay. Unsupported IntersectionObserver browsers contribute no impressions.
Ordinary rerenders, effect replay, and scrolling away/back reuse event IDs. A change in
ordered results, displayed prices, filters, sort, personalization readiness, consent or
account starts a new view. Reloading/remounting Browse also starts a new view. Each
product is counted at most once per view, protected by database uniqueness as well as
client deduplication. Bounded network retries reuse the same event ID. Authenticated
accounts are limited to 1,000 new impressions/hour; unknown products, invalid/big
payloads, cross-origin requests and conflicting reused IDs are rejected. The browser's
rank/context claims are not cryptographically attested; this is not fraud-proof telemetry.

**Attribution.** The last successfully acknowledged exposure per product in the current
tab is remembered in sessionStorage (up to 100 products; 30-minute TTL; account scoped).
Saves, unsaves, skips and retailer clicks sent through `useBandit` also send an independent
evaluation outcome, without waiting or changing navigation/training. This covers Browse
feedback and OfferTable's product-detail retailer links. The server requires the same
account and product and a receipt time within 30 minutes of the impression. Each action
type counts at most once per impression. Direct product visits without a remembered
exposure, guests, expired/cross-account tokens, and events without consent are excluded.
No attribution token enters the URL or is sent to a retailer. Clicking before the
impression is acknowledged, blocked sessionStorage, a new tab, dropped requests, or a
page close can lose attribution. Outcomes are UI action intents, not proof of a persisted
watchlist change, successful retailer navigation, or purchase. A save followed by unsave
still contributes to gross save rate; unsave rate is reported separately.

**Available metrics.** Run the operator-only script with database credentials:

```sh
npx tsx scripts/evaluation-report.ts
# Optional UTC [from,to) cohort, entirely within retained history and ending >=30m ago:
npx tsx scripts/evaluation-report.ts 2026-11-01T00:00:00Z 2026-11-02T00:00:00Z
```

The default is a seven-day cohort ending 30 minutes ago. Output contains aggregate
counts and rates segmented by ranking version, sort, one-based position, filtered flag
and personalization readiness. It does not export account IDs. There is no public
analytics API. Small aggregate groups can still reveal behavior; restrict script/database
access and apply a minimum group size before sharing results externally.

| Metric | Numerator | Denominator |
| --- | --- | --- |
| Save rate | Distinct impressions with at least one SAVE within 30m | Mature impressions in the cohort |
| Retailer-click rate | Distinct impressions with at least one CLICK_OUT within 30m | Same |
| Skip rate | Distinct impressions with at least one SKIP within 30m | Same |
| Unsave rate | Distinct impressions with at least one UNSAVE within 30m | Same |

Rates are fractions, not percentages. Zero denominators return `null`, not zero. The
metric helper reports immature impressions separately; the report only selects mature
cohorts so every included impression has a complete attribution opportunity. Cohorts
are selected by impression time, not outcome time. Deduplicated numerators cannot
exceed denominators. An impression with no outcome is “no observed action,” not proven
disinterest. Counts differ intentionally from the training event count.

**Deployment and retention.** Run `npx prisma migrate deploy` before deploying this
code and regenerate Prisma Client (`npm ci` already does this). Configure a strong
`CRON_SECRET` in Vercel. `vercel.json` schedules the authenticated
`/api/cron/evaluation-retention` job daily at 06:00 UTC. It removes impressions older
than 30 days and cascades outcomes; with a healthy daily job physical retention can
reach roughly 31 days. On other hosts, schedule the same authenticated GET daily.
Monitor failures and alert on missed cleanup; do not enable collection until cleanup
is configured and verified. Consent withdrawal deletes immediately. Backup retention
and deletion processes must also match the deployment's privacy commitments.

**Before claiming effectiveness.** This is observational instrumentation, not an A/B
experiment. Define the target population, eligibility/exclusions, primary metric,
minimum detectable effect/sample size, analysis window and guardrails in advance.
Establish consent-appropriate randomized assignment (including persisted experiment
and variant IDs, neither implemented here), stable assignment units, treatment isolation,
and sample-ratio/telemetry-loss checks before a controlled experiment. Account for
position/exposure bias, repeat users, opt-in selection, inventory/price changes and
seasonality; calculate uncertainty using the randomization unit rather than treating
all impressions as independent. Temporal held-out evaluation requires a frozen policy,
time-safe feature/catalog snapshots and no future-feedback leakage; current records
alone do not reconstruct old candidate sets or personalized scores. Save and retailer
click rates are engagement proxies, not purchase conversion. Report coverage, losses,
sample sizes and uncertainty alongside any comparison. No conversion uplift is claimed.

Tests cover validation, dwell/visibility cleanup, retries and duplicate protection,
attribution boundaries, mature-cohort metrics, authentication/consent and deletion.
CI additionally exercises real PostgreSQL constraints, concurrent duplicate writes,
withdrawal races and retention/account-deletion cascades with
`EVALUATION_TEST_DATABASE=1 npx tsx scripts/test-evaluation.ts` on a disposable database.
