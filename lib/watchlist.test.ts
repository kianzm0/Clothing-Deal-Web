import { afterEach, beforeEach, mock, test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { prisma } from "./prisma";
import type { Product } from "./types";

// Keep the real page, repository mapping, cards, and account API. Substitute
// database/session boundaries and the hook result for deterministic rendering.
const storePath = require.resolve("./store");
const actualStore = require(storePath);
let state = { ids: [] as string[], hydrated: true, toggle: (_id: string) => {} };
require.cache[storePath]!.exports = { ...actualStore, useWatchlist: () => state };
const { default: WatchlistClient } = require("../components/WatchlistClient");
const { default: WatchlistPage, dynamic } = require("../app/watchlist/page");
const { default: WatchlistError } = require("../app/watchlist/error");
const api = require("../app/api/watchlist/route");
const nextAuth = require("next-auth/next");
const restorations: Array<() => void> = [];
function stub(target: any, key: string, implementation: (...args: any[]) => any) {
  const original = target[key];
  const spy = mock.fn(implementation);
  target[key] = spy;
  restorations.push(() => { target[key] = original; });
  return spy;
}
const id = "392e56bf-88c0-40f7-917b-d3dbb3298e18";
const row = {
  id, name: "Newly published shirt", brand: "New brand", category: "T_SHIRT",
  colors: ["black"], sizes: ["M"], image: "",
  offers: [{ store: "Retailer", price: 27, originalPrice: 40, shippingCost: 0,
    sizesInStock: ["M"], lastUpdated: new Date("2026-10-30"),
    url: "https://example.test/shirt", status: "active" }],
};
let rows: typeof row[];
let session: { user: { id: string } } | null;
beforeEach(() => {
  rows = [structuredClone(row)];
  session = null;
  state = { ids: [], hydrated: true, toggle: (id) => {
    state.ids = state.ids.includes(id) ? state.ids.filter((saved) => saved !== id) : [...state.ids, id];
  } };
  stub(prisma.product, "findMany", async () => rows);
  stub(nextAuth, "getServerSession", async () => session);
});
afterEach(() => {
  restorations.reverse().forEach((restore) => restore());
  restorations.length = 0;
});
async function pageMarkup() {
  return renderToStaticMarkup(await WatchlistPage());
}
function elements(node: any): any[] {
  if (!React.isValidElement(node)) return [];
  return [node, ...React.Children.toArray((node.props as any).children).flatMap(elements)];
}

test("dynamic watchlist renders a saved UUID from the current PostgreSQL catalog", async () => {
  assert.equal(dynamic, "force-dynamic");
  state.ids = [id]; // Same IDs supplied by localStorage for signed-out visitors.
  let html = await pageMarkup();
  assert.match(html, /Newly published shirt/);
  assert.match(html, /\$27/);
  assert.match(html, new RegExp(`/product/${id}`));
  rows[0].offers[0].price = 19;
  html = await pageMarkup();
  assert.match(html, /\$19/);
  assert.doesNotMatch(html, /\$27/);
});

test("account API IDs resolve through the same dynamic catalog", async () => {
  session = { user: { id: "customer-1" } };
  const read = stub(prisma.watchlistItem, "findMany", async () => [{ productId: id }]);
  const result = await (await api.GET()).json();
  assert.equal(result.signedIn, true);
  assert.deepEqual(read.mock.calls[0].arguments[0], { where: { userId: "customer-1" }, select: { productId: true } });
  state.ids = result.ids;
  assert.match(await pageMarkup(), /Newly published shirt/);
});

test("signed-out page needs no authenticated watchlist API", async () => {
  const read = stub(prisma.watchlistItem, "findMany", async () => { throw new Error("Unexpected account read"); });
  assert.deepEqual(await (await api.GET()).json(), { signedIn: false, ids: [] });
  state.ids = [id];
  assert.match(await pageMarkup(), /Newly published shirt/);
  assert.equal(read.mock.callCount(), 0);
});

test("only saved catalog products appear and duplicate saved IDs render once", async () => {
  state.ids = [id, id];
  rows.push({ ...structuredClone(row), id: "other", name: "Not saved" });
  const html = await pageMarkup();
  assert.doesNotMatch(html, /Not saved/);
  assert.equal(html.match(/Newly published shirt/g)?.length, 1);
});

test("missing and review-only products show removable placeholders without broken cards", async () => {
  state.ids = [id, "removed"];
  rows[0].offers[0].status = "needs_review";
  const html = await pageMarkup();
  assert.equal(html.match(/currently unavailable/g)?.length, 2);
  assert.doesNotMatch(html, /Nothing saved yet|\/product\/|Newly published shirt/);
  assert.deepEqual(state.ids, [id, "removed"]);
});

test("a product without offers never reaches price rendering", () => {
  state.ids = [id];
  const products = [{ ...row, category: "t-shirt", offers: [] }] as Product[];
  assert.match(renderToStaticMarkup(React.createElement(WatchlistClient, { products })), /currently unavailable/);
});

test("unavailable entries can be removed and then show the empty state", () => {
  state.ids = ["removed"];
  const tree = WatchlistClient({ products: [] });
  const button = elements(tree).find((element) => element.type === "button");
  button.props.onClick();
  assert.deepEqual(state.ids, []);
  assert.match(renderToStaticMarkup(React.createElement(WatchlistClient, { products: [] })), /Nothing saved yet/);
});

test("cards use the page watchlist state so unsaving removes the card immediately", async () => {
  state.ids = [id];
  const page = await WatchlistPage();
  const tree = WatchlistClient(page.props);
  const card = elements(tree).find((element) => element.props.product?.id === id);
  assert.equal(card.props.watchlist, state);
  card.props.watchlist.toggle(id);
  assert.doesNotMatch(await pageMarkup(), /Newly published shirt/);
  assert.match(await pageMarkup(), /Nothing saved yet/);
});

test("hydration shows loading rather than a misleading empty watchlist", async () => {
  state.hydrated = false;
  const html = await pageMarkup();
  assert.match(html, /Loading your watchlist/);
  assert.doesNotMatch(html, /Nothing saved yet/);
});

test("catalog failures reach the retry boundary and never discard saved IDs", async () => {
  state.ids = [id];
  stub(prisma.product, "findMany", async () => { throw new Error("Database unavailable"); });
  await assert.rejects(WatchlistPage(), /Database unavailable/);
  const reset = mock.fn();
  const tree = WatchlistError({ reset });
  assert.match(renderToStaticMarkup(tree), /saved items have not been removed/);
  elements(tree).find((element) => element.type === "button").props.onClick();
  assert.equal(reset.mock.callCount(), 1);
  assert.deepEqual(state.ids, [id]);
});

test("account saves and removals remain scoped to the authenticated user", async () => {
  session = { user: { id: "customer-1" } };
  const save = stub(prisma.watchlistItem, "upsert", async () => ({}));
  const remove = stub(prisma.watchlistItem, "deleteMany", async () => ({ count: 1 }));
  const request = (method: string) => new Request("http://localhost/api/watchlist", {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ productId: id }),
  });
  assert.equal((await api.POST(request("POST"))).status, 200);
  assert.deepEqual(save.mock.calls[0].arguments[0].create, { userId: "customer-1", productId: id });
  assert.equal((await api.DELETE(request("DELETE"))).status, 200);
  assert.deepEqual(remove.mock.calls[0].arguments[0].where, { userId: "customer-1", productId: id });
});
