import test from "node:test";
import assert from "node:assert/strict";
import { parseReviewOverrides, requireNewProductFields } from "./review";

test("parses and normalizes editable review fields", () => { assert.deepEqual(parseReviewOverrides({ name: "  Hoodie ", priceCents: "4999", colors: ["black", "black"] }), { name: "Hoodie", priceCents: 4999, colors: ["black"] }); });
test("rejects invalid prices and malformed image URLs", () => { assert.throws(() => parseReviewOverrides({ priceCents: -1 }), /price is invalid/); assert.throws(() => parseReviewOverrides({ imageUrl: "not-a-url" }), /imageUrl must be a valid URL/); });
test("requires category and product identity for a new product", () => { assert.throws(() => requireNewProductFields("", { title: "Tee", brand: "Brand" }, {}), /category/); assert.deepEqual(requireNewProductFields("hoodie", { title: "Tee", brand: "Brand" }, { name: "Corrected" }), { category: "hoodie", name: "Corrected", brand: "Brand" }); });
