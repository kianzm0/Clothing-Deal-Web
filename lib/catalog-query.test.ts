import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCatalogQuery } from "./catalog-query";
import { POST } from "../app/api/catalog/lookup/route";
test("catalog rejects invalid filters and bounded lookups reject oversized lists", async () => {
  for (const query of ["category=invalid", "maxPrice=Infinity", "maxPrice=-1", "minDiscount=101", `after=${"a".repeat(201)}`]) assert.throws(() => parseCatalogQuery(new URLSearchParams(query)));
  const response = await POST(new Request("http://localhost/api/catalog/lookup", { method: "POST", body: JSON.stringify({ ids: Array(101).fill("id") }) }));
  assert.equal(response.status, 400);
  assert.equal(parseCatalogQuery(new URLSearchParams("category=t-shirt&brand=New+Brand")).brand, "New Brand");
});
