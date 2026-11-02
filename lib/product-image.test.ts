import test from "node:test";
import assert from "node:assert/strict";
import { hasSafeImageUrl, safeImageUrl } from "./product-image";

test("allows app-relative and HTTPS product images", () => {
  assert.equal(safeImageUrl("/images/tee-1.svg"), "/images/tee-1.svg");
  assert.equal(safeImageUrl("https://cdn.example.com/product.jpg"), "https://cdn.example.com/product.jpg");
});

test("rejects unsafe image schemes and ambiguous remote URLs", () => {
  for (const value of ["data:image/svg+xml,<svg>", "javascript:alert(1)", "//cdn.example.com/product.jpg", "https://user:pass@example.com/image.jpg"]) {
    assert.equal(hasSafeImageUrl(value), false);
  }
  assert.equal(hasSafeImageUrl("http://localhost/image.jpg"), false);
  assert.equal(hasSafeImageUrl("http://192.168.1.10/image.jpg"), false);
});

test("normalizes valid remote URLs and rejects oversized values", () => {
  assert.equal(safeImageUrl("HTTPS://CDN.EXAMPLE.COM/image.jpg"), "https://cdn.example.com/image.jpg");
  assert.equal(safeImageUrl("https://example.com/" + "a".repeat(2_050)), null);
});
