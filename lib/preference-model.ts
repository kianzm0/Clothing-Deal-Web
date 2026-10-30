import { Preferences, Product } from "./types";
import { bestOffer } from "./pricing";

// Time-decayed content preferences with one current vote per product.
// Repeat clicks and save/unsave toggles cannot create unlimited evidence.
// Pure functions shared by serving, training, and preference insights.

export interface TokenStats {
  pos: number; // decayed sum of reward
  neg: number; // decayed sum of (1 - reward)
}

export interface LikedItem {
  productId: string;
  tokens: string[];
  price: number;
  weight: number; // decay-weighted strength of the positive signal
}

export interface PreferenceProfile {
  tokens: Record<string, TokenStats>;
  liked: LikedItem[];
  observations: number;
  dismissed?: string[];
}

export interface Observation {
  product: Product;
  reward: number; // 0..1, see REWARD_BY_ACTION in lib/bandit.ts
  at: Date | string;
  action?: "SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT";
}

export const EMPTY_PROFILE: PreferenceProfile = { tokens: {}, liked: [], observations: 0 };

const HALF_LIFE_DAYS = 30;
const MAX_LIKED_ITEMS = 50;
const LIKED_REWARD_THRESHOLD = 0.75;

const PRICE_BANDS: { label: string; max: number }[] = [
  { label: "under-25", max: 25 },
  { label: "25-50", max: 50 },
  { label: "50-100", max: 100 },
  { label: "100-plus", max: Infinity },
];

export function priceBand(price: number): string {
  return PRICE_BANDS.find((b) => price < b.max)!.label;
}

// The sparse "bag of attributes" representation everything else in
// this file works on.
export function productTokens(product: Product): string[] {
  const price = bestOffer(product).price;
  return [
    `brand:${product.brand}`,
    `category:${product.category}`,
    ...Array.from(new Set(product.colors)).map((c) => `color:${c}`),
    `price:${priceBand(price)}`,
  ];
}

function decayWeight(at: Date | string, now: Date): number {
  const ageDays = Math.max(0, (now.getTime() - new Date(at).getTime()) / (1000 * 60 * 60 * 24));
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

export function buildProfile(observations: Observation[], now: Date = new Date()): PreferenceProfile {
  const tokens: Record<string, TokenStats> = {};
  const likedById = new Map<string, LikedItem>();

  // Sort a copy so callers need not know the database's retrieval order.
  const latest = new Map<string, Observation>();
  for (const obs of [...observations].filter(o => Number.isFinite(o.reward) && Number.isFinite(new Date(o.at).getTime()))
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime())) {
    if (!obs.product.offers.length) continue;
    const previous = latest.get(obs.product.id);
    // Casual clicks do not undo an explicit save or dismissal.
    if (obs.action === "CLICK_OUT" && previous?.action && previous.action !== "CLICK_OUT") continue;
    latest.set(obs.product.id, obs);
  }
  const dismissed: string[] = [];
  for (const obs of latest.values()) {
    const reward = Math.max(0, Math.min(1, obs.reward));
    const w = decayWeight(obs.at, now) * (obs.action === "CLICK_OUT" ? 0.5 : obs.action === "UNSAVE" ? 0.25 : 1);
    const productTokenList = productTokens(obs.product);
    for (const token of productTokenList) {
      const stats = (tokens[token] ??= { pos: 0, neg: 0 });
      stats.pos += w * reward;
      stats.neg += w * (1 - reward);
    }
    if (obs.action === "SKIP" || (!obs.action && reward === 0)) dismissed.push(obs.product.id);
    if (reward >= LIKED_REWARD_THRESHOLD && obs.action !== "UNSAVE") {
      likedById.set(obs.product.id, {
        productId: obs.product.id,
        tokens: productTokenList,
        price: bestOffer(obs.product).price,
        weight: w * reward,
      });
    }
  }

  const liked = Array.from(likedById.values())
    .sort((a, b) => b.weight - a.weight)
    .slice(0, MAX_LIKED_ITEMS);

  return { tokens, liked, observations: latest.size, dismissed };
}

// Posterior mean of a Beta(1 + pos, 1 + neg). 0.5 = no opinion.
export function tokenAffinity(stats: TokenStats | undefined): number {
  if (!stats) return 0.5;
  return (1 + stats.pos) / (2 + stats.pos + stats.neg);
}

// Average of the product's token affinities, rescaled to [-1, 1]
// (0 = neutral / unknown). Shrinkage comes for free from the prior:
// a token seen once barely moves off 0.
export function learnedAffinity(product: Product, profile: PreferenceProfile): number {
  const tokens = productTokens(product);
  // Each attribute family gets equal influence; ten listed colors should
  // not outweigh brand, category, and price combined.
  const groups = ["brand:", "category:", "color:", "price:"];
  return groups.reduce((sum, prefix) => {
    const group = tokens.filter(t => t.startsWith(prefix));
    return sum + (group.length ? group.reduce((s, t) => s + (tokenAffinity(profile.tokens[t]) - 0.5) * 2, 0) / group.length : 0);
  }, 0) / groups.length;
}

function cosine(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setB = new Set(b);
  const overlap = a.filter((t) => setB.has(t)).length;
  return overlap / Math.sqrt(a.length * b.length);
}

// Max cosine similarity to anything the user liked, excluding the
// product itself so a saved item doesn't trivially score 1 against
// its own history.
export function similarityToLiked(product: Product, profile: PreferenceProfile): number {
  const tokens = productTokens(product);
  let best = 0;
  for (const item of profile.liked) {
    if (item.productId === product.id) continue;
    best = Math.max(best, cosine(tokens, item.tokens) * Math.min(1, item.weight));
  }
  return best;
}

// ---------------------------------------------------------------------------
// Insights: turn the learned profile into something a person can read
// and act on.

export interface AttributeInsight {
  kind: "brand" | "category" | "color" | "price";
  value: string;
  affinity: number; // posterior mean, 0..1
  evidence: number; // decayed interaction count behind it
}

export interface PreferenceSuggestions {
  favoriteBrands: string[];
  dislikedBrands: string[];
  colors: string[];
  maxBudget: number | null;
}

export interface PreferenceInsights {
  likes: AttributeInsight[];
  dislikes: AttributeInsight[];
  suggestions: PreferenceSuggestions;
  observations: number;
}

const MIN_EVIDENCE = 2;
const LIKE_THRESHOLD = 0.68;
const DISLIKE_THRESHOLD = 0.32;

function parseToken(token: string): { kind: AttributeInsight["kind"]; value: string } | null {
  const idx = token.indexOf(":");
  const kind = token.slice(0, idx);
  if (kind !== "brand" && kind !== "category" && kind !== "color" && kind !== "price") return null;
  return { kind, value: token.slice(idx + 1) };
}

// Decay-weighted percentile of liked prices, rounded up to the next
// $10 — a budget that would have covered most of what the user
// actually saved.
function inferBudget(liked: LikedItem[], percentile = 0.8): number | null {
  if (liked.length < 3) return null;
  const sorted = [...liked].sort((a, b) => a.price - b.price);
  const total = sorted.reduce((s, i) => s + i.weight, 0);
  let cumulative = 0;
  for (const item of sorted) {
    cumulative += item.weight;
    if (cumulative / total >= percentile) return Math.ceil(item.price / 10) * 10;
  }
  return Math.ceil(sorted[sorted.length - 1].price / 10) * 10;
}

export function summarizeProfile(profile: PreferenceProfile, prefs: Preferences): PreferenceInsights {
  const attributes: AttributeInsight[] = [];
  for (const [token, stats] of Object.entries(profile.tokens)) {
    const parsed = parseToken(token);
    if (!parsed) continue;
    const evidence = stats.pos + stats.neg;
    if (evidence < MIN_EVIDENCE) continue;
    attributes.push({ ...parsed, affinity: tokenAffinity(stats), evidence });
  }

  const likes = attributes
    .filter((a) => a.affinity >= LIKE_THRESHOLD)
    .sort((a, b) => b.affinity - a.affinity || b.evidence - a.evidence);
  const dislikes = attributes
    .filter((a) => a.affinity <= DISLIKE_THRESHOLD)
    .sort((a, b) => a.affinity - b.affinity || b.evidence - a.evidence);

  const budget = inferBudget(profile.liked);

  return {
    likes,
    dislikes,
    observations: profile.observations,
    suggestions: {
      favoriteBrands: likes
        .filter((a) => a.kind === "brand" && !prefs.favoriteBrands.includes(a.value))
        .map((a) => a.value),
      dislikedBrands: dislikes
        .filter((a) => a.kind === "brand" && !prefs.dislikedBrands.includes(a.value))
        .map((a) => a.value),
      colors: likes.filter((a) => a.kind === "color" && !prefs.colors.includes(a.value)).map((a) => a.value),
      // Only suggest a budget change that's meaningfully different
      // from the current one, not $10 of noise either way.
      maxBudget: budget !== null && Math.abs(budget - prefs.maxBudget) >= 20 ? budget : null,
    },
  };
}
