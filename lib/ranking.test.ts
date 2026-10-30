import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_WEIGHTS, FEATURE_NAMES, alignWeights, featurize, predict, updateWeights, REWARD_BY_ACTION, STRENGTH_BY_ACTION } from "./bandit";
import { buildProfile, similarityToLiked, learnedAffinity, EMPTY_PROFILE } from "./preference-model";
import { rankProducts } from "./ranking";
import { recommendationOffer } from "./recommendation-offer";
import { DEFAULT_PREFERENCES, Product } from "./types";

const now = new Date("2026-10-29T12:00:00Z");
const prefs = { ...DEFAULT_PREFERENCES, maxBudget: 100, sizes: ["M"] };
function product(id: string, brand = "Nike", price = 40): Product {
  return { id, name: id, brand, category: "hoodie", colors: ["black"], sizes: ["M"], image: "",
    offers: [{ store: "Shop", price, originalPrice: 80, shippingCost: 0, sizesInStock: ["M"], lastUpdated: now.toISOString(), url: "#" }] };
}
const order = (items: Product[]) => rankProducts(items, prefs, DEFAULT_WEIGHTS, EMPTY_PROFILE, +now).map(r => r.product.id);

test("ranking is reproducible regardless of input order and leaves inputs intact", () => {
  const items = [product("b"), product("a"), product("c", "Gap")];
  const original = structuredClone(items);
  assert.deepEqual(order(items), order([...items].reverse()));
  for (let i = 0; i < 20; i++) assert.deepEqual(order(items), order(items));
  assert.deepEqual(items, original);
});

test("diversity surfaces a different brand among equally relevant items", () => {
  assert.deepEqual(order([product("a"), product("b"), product("c", "Gap")]), ["a", "c", "b"]);
});

test("personalization promotes a held-out related item over a disliked style", () => {
  const saved = product("saved");
  const skipped = { ...product("skip", "Gap", 15), category: "t-shirt" as const, colors: ["pink"] };
  const profile = buildProfile([{ product: saved, action: "SAVE", reward: 1, at: now },
    { product: skipped, action: "SKIP", reward: 0, at: now }], now);
  const candidate = { ...skipped, id: "other-gap" };
  const ranked = rankProducts([candidate, product("new-nike")], prefs, DEFAULT_WEIGHTS, profile, +now);
  assert.equal(ranked[0].product.id, "new-nike");
  assert.ok(ranked[0].reasons.includes("Based on your activity"));
});

test("budget fit includes shipping and changes smoothly with price", () => {
  const a = product("a", "Nike", 90);
  a.offers[0].shippingCost = 20;
  assert.ok(featurize(a, prefs, EMPTY_PROFILE, +now)[6] < 0);
  assert.ok(featurize(product("b", "Nike", 40), prefs)[6] > featurize(product("c", "Nike", 90), prefs)[6]);
});

test("size match uses a purchasable offer instead of catalog sizes", () => {
  const a = product("a");
  a.offers[0].sizesInStock = ["S"];
  assert.equal(featurize(a, prefs)[4], -1);
  a.offers.push({ ...a.offers[0], price: 70, sizesInStock: ["M"] });
  assert.equal(recommendationOffer(a, prefs)?.price, 70);
  assert.equal(featurize(a, prefs)[4], 1);
});

test("invalid, review-only and sold-out offers cannot enter recommendations", () => {
  const a = product("a"), b = product("b"), c = product("c"), d = product("d");
  a.offers = [];
  b.offers[0].status = "needs_review";
  c.offers[0].availability = "https://schema.org/OutOfStock";
  d.offers[0].price = NaN;
  assert.deepEqual(order([a, b, c, d]), []);
});

test("fresh prices win an otherwise identical comparison", () => {
  const stale = product("a");
  stale.offers[0].lastUpdated = "2026-01-01";
  assert.equal(order([stale, product("b")])[0], "b");
});

test("discount preference and explicit dislikes affect ranking", () => {
  const a = product("a");
  assert.equal(featurize(a, { ...prefs, minDiscountPct: 60 })[10], -1);
  const ranked = rankProducts([a, product("b", "Gap")], { ...prefs, dislikedBrands: ["nike"] }, DEFAULT_WEIGHTS, EMPTY_PROFILE, +now);
  assert.equal(ranked[0].product.id, "b");
});

test("repeat interactions on one product do not manufacture preference confidence", () => {
  const observation = { product: product("a"), reward: 1, at: now, action: "SAVE" as const };
  assert.deepEqual(buildProfile(Array(100).fill(observation), now), buildProfile([observation], now));
});

test("unsave retracts similarity without being a strong dislike", () => {
  const p = product("a");
  const profile = buildProfile([{ product: p, action: "SAVE", reward: 1, at: new Date(+now - 1000) },
    { product: p, action: "UNSAVE", reward: 0.5, at: now }], now);
  assert.equal(profile.liked.length, 0);
  assert.equal(learnedAffinity(product("b"), profile), 0);
});

test("unsorted feedback respects chronology and clicks do not undo a dismissal", () => {
  const p = product("a");
  const profile = buildProfile([
    { product: p, action: "CLICK_OUT", reward: 0.75, at: new Date(+now + 1000) },
    { product: p, action: "SKIP", reward: 0, at: now },
    { product: p, action: "SAVE", reward: 1, at: new Date(+now - 1000) },
  ], now);
  assert.deepEqual(profile.dismissed, ["a"]);
  assert.equal(profile.liked.length, 0);
  assert.deepEqual(rankProducts([p], prefs, DEFAULT_WEIGHTS, profile, +now), []);
});

test("saving again reverses a dismissal", () => {
  const p = product("a");
  const profile = buildProfile([{ product: p, action: "SKIP", reward: 0, at: new Date(+now - 1000) },
    { product: p, action: "SAVE", reward: 1, at: now }], now);
  assert.deepEqual(profile.dismissed, []);
  assert.equal(profile.liked.length, 1);
});

test("old likes lose similarity influence and malformed history is ignored", () => {
  const p = product("a"), candidate = product("b");
  const fresh = buildProfile([{ product: p, reward: 1, at: now }], now);
  const old = buildProfile([{ product: p, reward: 1, at: new Date(+now - 120 * 86400000) }], now);
  assert.ok(similarityToLiked(candidate, old) < similarityToLiked(candidate, fresh) / 10);
  const invalid = buildProfile([{ product: p, reward: NaN, at: now }, { product: p, reward: 1, at: "invalid" }], now);
  assert.equal(invalid.observations, 0);
});

test("clicks have less influence than saves", () => {
  const p = product("a");
  const save = buildProfile([{ product: p, reward: 1, action: "SAVE", at: now }], now);
  const click = buildProfile([{ product: p, reward: 0.75, action: "CLICK_OUT", at: now }], now);
  assert.ok(learnedAffinity(product("b"), save) > learnedAffinity(product("b"), click));
  const f = featurize(p, prefs);
  const saveScore = predict(updateWeights(DEFAULT_WEIGHTS, f, REWARD_BY_ACTION.SAVE, STRENGTH_BY_ACTION.SAVE), f);
  const clickScore = predict(updateWeights(DEFAULT_WEIGHTS, f, REWARD_BY_ACTION.CLICK_OUT, STRENGTH_BY_ACTION.CLICK_OUT), f);
  assert.ok(saveScore > clickScore);
});

test("learning moves scores in the direction of feedback and stays finite", () => {
  const f = featurize(product("a"), prefs);
  const before = predict(DEFAULT_WEIGHTS, f);
  assert.ok(predict(updateWeights(DEFAULT_WEIGHTS, f, 1), f) > before);
  assert.ok(predict(updateWeights(DEFAULT_WEIGHTS, f, 0), f) < before);
  let weights = [...DEFAULT_WEIGHTS];
  for (let i = 0; i < 10000; i++) weights = updateWeights(weights, f, i % 2);
  assert.ok(weights.every(w => Number.isFinite(w) && Math.abs(w) <= 6));
  assert.equal(alignWeights([NaN, Infinity]).length, FEATURE_NAMES.length);
  assert.ok(Number.isFinite(predict([NaN], [Infinity])));
});
