# ThreadScout

ThreadScout is an MVP clothing price-comparison website for finding apparel deals, comparing offers, saving favorites, and learning user preferences over time.

This version is dependency-free so it can run anywhere as a static site while the product direction is still being validated.

## Features

- Search and browse T-shirts, hoodies, sweatshirts, and long sleeves.
- Filter by category, brand, size, color, max price, and discount.
- Sort by best match, lowest price, biggest discount, and freshest update.
- Product detail pages with offer comparison by store, shipping, size availability, and freshness.
- Saved item watchlist using browser storage.
- Preferences page for sizes, favorite brands, disliked brands, colors, fits, budget, and discount threshold.
- Rule-based recommendation scoring from explicit preferences.
- Local product imagery and seeded demo catalog.

## Run locally

Use any static file server from the project root:

```bash
python3 -m http.server 3000
```

Then open:

```text
http://localhost:3000
```

You can also open `index.html` directly in a browser, but a local server is closer to how the site will behave when hosted.

## Suggested GitHub Pages deploy

Because this MVP is static, it can be deployed with GitHub Pages:

1. Push this project to a GitHub repository.
2. Open the repository settings.
3. Go to Pages.
4. Set the source to the default branch and root folder.
5. Save and wait for the Pages URL.

## Next engineering phases

The static MVP intentionally keeps data local. The next production steps are:

1. Rebuild the same UX in Next.js with TypeScript once dependencies can be installed.
2. Move seeded products into PostgreSQL using Prisma or Drizzle.
3. Add authentication with Supabase Auth, Clerk, or Auth.js.
4. Replace demo offers with affiliate feeds, retailer APIs, or approved product feeds.
5. Add server-side event tracking for searches, saves, filters, outbound clicks, and skips.
6. Add background jobs for price refresh and price-drop alerts.
7. Add privacy controls, affiliate disclosure, pricing freshness labels, and launch analytics.

## Data-source note

For production, prefer affiliate networks, retailer APIs, shopping APIs, or partner product feeds. Scraping should be treated carefully because retailer sites may restrict it in their terms, block it technically, or change markup frequently.
