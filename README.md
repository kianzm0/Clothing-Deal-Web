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

## Phase 5: RL-based recommendations (done)

"Best match" now uses a contextual bandit instead of pure hand-tuned
rules, when you're signed in.

**Why a contextual bandit, not deep RL:** a project like this will
never generate enough interaction data to train a policy network —
you'd be fitting noise, not signal. A linear contextual bandit
(logistic regression + online SGD + epsilon-greedy exploration) is
the real, production-proven approach for this exact problem — it's
what most retail/streaming ranking systems actually run. It updates
from a single interaction, needs no GPU or replay buffer, and the
rule-based score from Phase 1 became its cold-start prior instead of
being thrown away.

### How it works

- `lib/bandit.ts` — pure math (no Prisma import, so it runs
  identically server- and client-side): turns a product + your
  preferences into a 7-feature vector, scores it with a linear
  model, and does one online gradient step per interaction.
- Signals that train it: **Save** (+1), **Not interested** (0, the
  only explicit negative signal), **Unsave** (0.25, a soft walk-back
  rather than a hard penalty), **clicking through to an actual
  store** (+1, arguably the strongest real signal there is).
- `prisma/schema.prisma` — new `Interaction` (full event log) and
  `BanditWeights` (current learned weights per user) tables.
- `/api/interactions` (POST) logs the event and updates weights;
  `/api/bandit-weights` (GET) serves the current weights so the
  client can re-rank instantly without waiting on a request.
- Signed-out visitors never train or use the bandit — they get the
  exact same deterministic rule-based sort as before Phase 5.

### Setup

After the Phase 4 migration, run one more:
`npx prisma migrate dev --name add_bandit`

### Honest limitations

- **Cold start is real.** A brand-new account's first several
  recommendations lean heavily on the informed prior in
  `DEFAULT_WEIGHTS`, not on anything learned. That's intentional —
  it's better than random — but don't expect it to feel personalized
  until you've saved/skipped a handful of items.
- **No offline evaluation yet.** There's no A/B test or held-out
  metric proving the bandit beats the old rule-based score — right
  now it's "this is the standard right-sized approach," not "this is
  measured to work better." Adding that would mean logging which
  arm (bandit vs. rules) served each session and comparing
  save-through rate.
- **Per-product exploration jitter is visible, not just internal.**
  `explorationScore()` adds randomness directly to the sort order, so
  don't be surprised if "Best match" isn't perfectly stable across
  reloads early on — that's the exploration side of
  explore/exploit working as intended, not a bug.

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

## Next up (Phase 7+, per your original roadmap)

1. Real offers via affiliate feeds or retailer APIs (drop the scraping idea — ToS risk)
2. Background jobs for price refresh + price-drop alerts
3. Offline evaluation for the bandit (compare save-through rate vs. the old rule-based sort)
