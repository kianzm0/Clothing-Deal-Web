-- Preserve pre-migration currency uncertainty. Only newly inserted offers default to USD.
ALTER TABLE offers ADD COLUMN currency TEXT;
ALTER TABLE offers ALTER COLUMN currency SET DEFAULT 'USD';
-- Abort instead of silently clamping invalid or out-of-range amounts.
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM offers WHERE price < 0 OR price >= 1000000000000 OR "originalPrice" < 0 OR "originalPrice" >= 1000000000000 OR "shippingCost" < 0 OR "shippingCost" >= 1000000000000) THEN
 RAISE EXCEPTION 'Review invalid offer amounts before applying catalog migration';
 END IF;
END $$;
ALTER TABLE offers ALTER COLUMN price TYPE DECIMAL(14,2) USING round(price::numeric,2),
 ALTER COLUMN "originalPrice" TYPE DECIMAL(14,2) USING round("originalPrice"::numeric,2),
 ALTER COLUMN "shippingCost" TYPE DECIMAL(14,2) USING round("shippingCost"::numeric,2);
DELETE FROM watchlist_items w WHERE NOT EXISTS (SELECT 1 FROM products p WHERE p.id = w."productId");
ALTER TABLE watchlist_items ADD CONSTRAINT "watchlist_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "watchlist_items_productId_idx" ON watchlist_items("productId");
CREATE INDEX "interactions_userId_createdAt_id_idx" ON interactions("userId", "createdAt", id);
CREATE INDEX "interactions_userId_productId_createdAt_idx" ON interactions("userId", "productId", "createdAt");
CREATE INDEX "products_category_brand_id_idx" ON products(category, brand, id);
