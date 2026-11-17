# Bounded catalog reads

Browse uses a 48-product keyset page. Brand, category, total price including shipping and minimum discount are applied in SQL before pagination with bound parameters. Deleted cursor rows do not invalidate later pages. Personalized ranking and sort controls operate within the current candidate page; the interface states this explicitly. This is not global personalized top-K retrieval.

Watchlists fetch only saved product IDs, in batches of 100, for both guests and accounts. Requests are cancelled on scope/ID changes and failures offer retry without deleting saved IDs. Editorial product selection uses search and pages of 100 lightweight records, including products with no public offer. Attribute queries retrieve distinct strings rather than full products and offers, capped at 1,000 options per dimension.

History lookup indexes were added in the catalog-integrity migration. CI tests multiple catalog pages, category/brand/price filters, deleted cursors, held offers and SQL injection inputs with 103 products. Production latency and query plans still need measurement at actual inventory scale.
