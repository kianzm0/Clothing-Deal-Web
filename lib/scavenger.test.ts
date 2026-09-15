import test from "node:test";
import assert from "node:assert/strict";
import { extractDealCandidate } from "./scavenger";
import { findRetailer, normalizeProductUrl } from "./retailers";

test("normalizes product URLs by removing tracking parameters", () => {
  const url = normalizeProductUrl(
    "https://www.nike.com/t/example-shoe?utm_source=newsletter&color=red&gclid=abc#reviews"
  );

  assert.equal(url.toString(), "https://www.nike.com/t/example-shoe?color=red");
});

test("extracts product deal fields from JSON-LD", () => {
  const html = `
    <html>
      <head>
        <meta property="og:image" content="/fallback.jpg">
        <script type="application/ld+json">
          {
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Air Max Example Running Shoe",
            "image": "https://static.nike.com/example.jpg",
            "brand": { "@type": "Brand", "name": "Nike" },
            "sku": "NK-123",
            "offers": {
              "@type": "Offer",
              "price": "79.99",
              "priceCurrency": "USD",
              "highPrice": "129.99",
              "availability": "https://schema.org/InStock"
            }
          }
        </script>
      </head>
    </html>
  `;

  const deal = extractDealCandidate({
    html,
    sourceUrl: "https://www.nike.com/t/example",
    canonicalUrl: "https://www.nike.com/t/example",
    retailer: { domain: "nike.com", name: "Nike" },
    fetchedAt: "2026-09-15T00:00:00.000Z",
  });

  assert.equal(deal.title, "Air Max Example Running Shoe");
  assert.equal(deal.brand, "Nike");
  assert.equal(deal.priceCents, 7999);
  assert.equal(deal.listPriceCents, 12999);
  assert.equal(deal.discountPercent, 38);
  assert.equal(deal.availability, "in_stock");
  assert.equal(deal.status, "active");
});

test("falls back to meta tags and marks incomplete extraction for review", () => {
  const html = `
    <html>
      <head>
        <title>Wool Blend Coat</title>
        <meta property="og:title" content="Wool Blend Coat">
      </head>
    </html>
  `;

  const deal = extractDealCandidate({
    html,
    sourceUrl: "https://www.zara.com/us/example",
    canonicalUrl: "https://www.zara.com/us/example",
    retailer: { domain: "zara.com", name: "Zara" },
    fetchedAt: "2026-09-15T00:00:00.000Z",
  });

  assert.equal(deal.title, "Wool Blend Coat");
  assert.equal(deal.priceCents, null);
  assert.equal(deal.status, "needs_review");
  assert.match(deal.warnings.join(" "), /Missing current price/);
});

test("recognizes retailers already sold on this site", () => {
  const retailer = findRetailer("www.everlane.com");
  assert.equal(retailer?.name, "Everlane");
});
