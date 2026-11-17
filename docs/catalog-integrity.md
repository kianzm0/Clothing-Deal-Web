# Catalog integrity deployment

Apply migrations before deploying application code. Back up and inspect existing offer amounts first. The migration converts floating prices to decimal(14,2), rounding to cents, and fails for invalid amounts rather than clamping them.

Existing offers receive NULL currency and are withheld from the public catalog until verified. Refresh through the editorial ingestion workflow to persist verified USD, or review source evidence before explicitly updating legacy currency. Do not blanket-label unknown legacy offers USD. New manual inserts default to USD; ingestion explicitly checks and stores currency.

The migration removes watchlist references to missing products, then adds a cascading product foreign key. Saved references to existing products are preserved. Product deletion removes its saved references. Application writes check existence and handle concurrent deletion.

CI exercises decimal arithmetic, concurrent duplicate saves, unknown products, currency visibility and deletion cascades against disposable PostgreSQL. Additional history and category/brand indexes support bounded queries.
