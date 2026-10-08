import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_PREFERENCES, Product } from "./types";
import {
  buildProfile,
  learnedAffinity,
  similarityToLiked,
  summarizeProfile,
  tokenAffinity,
  EMPTY_PROFILE,
} from "./preference-model";
import { DEFAULT_WEIGHTS, FEATURE_NAMES, alignWeights, featurize, predict } from "./bandit";

const NOW = new Date("2026-10-01T00:00:00Z");

function product(id: string, brand: string, category: Product["category"], colors: string[], price: number): Product {
  return {
    id,
    name: `${brand} ${category}`,
    brand,
    category,
    colors,
    sizes: ["M"],
    image: "",
    offers: [
      { store: brand, price, originalPrice: price, shippingCost: 0, sizesInStock: ["M"], lastUpdated: "2026-09-30", url: "#" },
    ],
  };
}

const nikeHoodieBlack = product("a", "Nike", "hoodie", ["black"], 60);
const nikeHoodieGray = product("b", "Nike", "hoodie", ["gray"], 65);
const nikeHoodieNavy = product("c", "Nike", "hoodie", ["navy"], 70);
const gapTeeWhite = product("d", "Gap", "t-shirt", ["white"], 15);
const gapTeePink = product("e", "Gap", "t-shirt", ["pink"], 12);
const nikeHoodieBlackNew = product("f", "Nike", "hoodie", ["black"], 62);

const history = [
  { product: nikeHoodieBlack, reward: 1, at: NOW },
  { product: nikeHoodieGray, reward: 1, at: NOW },
  { product: nikeHoodieNavy, reward: 1, at: NOW },
  { product: gapTeeWhite, reward: 0, at: NOW },
  { product: gapTeePink, reward: 0, at: NOW },
];

test("learns brand affinity from implicit feedback the user never typed in", () => {
  const profile = buildProfile(history, NOW);
  assert.ok(tokenAffinity(profile.tokens["brand:Nike"]) > 0.75);
  assert.ok(tokenAffinity(profile.tokens["brand:Gap"]) < 0.4);
  assert.ok(learnedAffinity(nikeHoodieBlackNew, profile) > 0);
  assert.ok(learnedAffinity(gapTeeWhite, profile) < 0);
  assert.equal(learnedAffinity(nikeHoodieBlackNew, EMPTY_PROFILE), 0);
});

test("older interactions decay toward neutral", () => {
  const old = new Date(NOW.getTime() - 120 * 24 * 60 * 60 * 1000);
  const fresh = buildProfile([{ product: nikeHoodieBlack, reward: 1, at: NOW }], NOW);
  const stale = buildProfile([{ product: nikeHoodieBlack, reward: 1, at: old }], NOW);
  assert.ok(tokenAffinity(fresh.tokens["brand:Nike"]) > tokenAffinity(stale.tokens["brand:Nike"]));
  assert.ok(tokenAffinity(stale.tokens["brand:Nike"]) - 0.5 < 0.05);
});

test("item similarity favors close matches to liked items and ignores the item itself", () => {
  const profile = buildProfile(history, NOW);
  assert.equal(similarityToLiked(nikeHoodieBlackNew, profile), 1);
  assert.ok(similarityToLiked(gapTeeWhite, profile) < 0.3);

  const onlySelf = buildProfile([{ product: nikeHoodieBlack, reward: 1, at: NOW }], NOW);
  assert.equal(similarityToLiked(nikeHoodieBlack, onlySelf), 0);
});

test("a later 'not interested' removes an item from the liked set", () => {
  const profile = buildProfile(
    [
      { product: nikeHoodieBlack, reward: 1, at: NOW },
      { product: nikeHoodieBlack, reward: 0, at: NOW },
    ],
    NOW
  );
  assert.equal(profile.liked.length, 0);
});

test("summarizes learned tastes into actionable preference suggestions", () => {
  const insights = summarizeProfile(buildProfile(history, NOW), DEFAULT_PREFERENCES);
  assert.deepEqual(insights.suggestions.favoriteBrands, ["Nike"]);
  assert.deepEqual(insights.suggestions.dislikedBrands, ["Gap"]);
  assert.equal(insights.suggestions.maxBudget, 70);
  assert.ok(insights.likes.some((a) => a.kind === "category" && a.value === "hoodie"));

  const already = summarizeProfile(buildProfile(history, NOW), {
    ...DEFAULT_PREFERENCES,
    favoriteBrands: ["Nike"],
    maxBudget: 75,
  });
  assert.deepEqual(already.suggestions.favoriteBrands, []);
  assert.equal(already.suggestions.maxBudget, null);
});

test("bandit ranks by learned taste even with empty explicit preferences", () => {
  const profile = buildProfile(history, NOW);
  const nikeScore = predict(DEFAULT_WEIGHTS, featurize(nikeHoodieBlackNew, DEFAULT_PREFERENCES, profile));
  const gapScore = predict(DEFAULT_WEIGHTS, featurize(gapTeeWhite, DEFAULT_PREFERENCES, profile));
  assert.ok(nikeScore > gapScore);
  assert.equal(featurize(gapTeeWhite, DEFAULT_PREFERENCES, profile).length, FEATURE_NAMES.length);
});

test("weights stored before the new features existed are padded, not reset", () => {
  const legacy = [0.1, 1.3, -1.9, 0.7, 0.5, 1.1, 0.9];
  const aligned = alignWeights(legacy);
  assert.equal(aligned.length, DEFAULT_WEIGHTS.length);
  assert.deepEqual(aligned.slice(0, legacy.length), legacy);
  assert.deepEqual(aligned.slice(legacy.length), DEFAULT_WEIGHTS.slice(legacy.length));
});
