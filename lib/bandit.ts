import { Preferences, Product } from "./types";
import { bestOffer, discountPct } from "./pricing";

// Contextual bandit for "Best match" ranking.
//
// Why a bandit and not "real" deep RL: a solo project's traffic
// never generates enough (state, action, long-horizon reward) tuples
// to train a policy network — you'd be fitting noise. A linear
// contextual bandit is the standard, production-proven approach for
// this exact problem (it's what most e-commerce/streaming ranking
// systems actually run): it updates online from a single interaction,
// needs no replay buffer or GPU, and degrades gracefully to sane
// behavior with only a few data points.
//
// Model: logistic regression over a small feature vector, trained
// online via one SGD step per interaction (contextual bandit reward
// signal), with epsilon-greedy exploration layered on top at
// serving time. This file is pure math — no Prisma import — so the
// exact same scoring function runs server-side (for the API route)
// and client-side (for instant re-ranking after an interaction,
// without waiting on a round trip).

export const FEATURE_NAMES = [
  "bias",
  "favoriteBrand",
  "dislikedBrand",
  "colorMatch",
  "sizeMatch",
  "discountFrac",
  "priceFit",
] as const;

export type FeatureVector = number[];

// Informed prior, not a blank slate: cold start (a brand-new user
// with zero interactions) should still roughly track the old
// rule-based scoring, not rank randomly until enough data arrives.
export const DEFAULT_WEIGHTS: number[] = [0, 1.2, -2.0, 0.6, 0.6, 1.0, 0.8];

export function featurize(product: Product, prefs: Preferences): FeatureVector {
  const offer = bestOffer(product);
  const discount = discountPct(offer) / 100;
  const priceFit = offer.price <= prefs.maxBudget ? 1 : -1;

  return [
    1, // bias
    prefs.favoriteBrands.includes(product.brand) ? 1 : 0,
    prefs.dislikedBrands.includes(product.brand) ? 1 : 0,
    product.colors.some((c) => prefs.colors.includes(c)) ? 1 : 0,
    product.sizes.some((s) => prefs.sizes.includes(s)) ? 1 : 0,
    discount,
    priceFit,
  ];
}

function sigmoid(z: number): number {
  return 1 / (1 + Math.exp(-z));
}

function dot(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

// Predicted probability the user would engage positively with this
// product, given the current learned weights.
export function predict(weights: number[], features: FeatureVector): number {
  return sigmoid(dot(weights, features));
}

const LEARNING_RATE = 0.15;
const L2_REGULARIZATION = 0.01;

// One online gradient step of logistic regression. `reward` is
// clamped to [0, 1] — SAVE/CLICK_OUT are positive examples, SKIP is
// a negative example, UNSAVE nudges back toward neutral. This is
// the entire "learning" step: no batching, no epochs, applied the
// moment an interaction happens.
export function updateWeights(weights: number[], features: FeatureVector, reward: number): number[] {
  const target = Math.max(0, Math.min(1, reward));
  const predicted = predict(weights, features);
  const error = target - predicted;

  return weights.map((w, i) => w + LEARNING_RATE * error * features[i] - LEARNING_RATE * L2_REGULARIZATION * w);
}

// Epsilon-greedy exploration: with probability epsilon, jitter the
// score enough to occasionally surface a product the model is
// unsure about, instead of always exploiting the current best
// guess. Epsilon decays as the user accumulates interactions, so a
// brand-new account explores more and a well-trained one mostly
// exploits.
export function explorationScore(baseScore: number, interactionCount: number): number {
  const epsilon = Math.max(0.05, 0.3 - interactionCount * 0.01);
  if (Math.random() < epsilon) {
    return baseScore + (Math.random() - 0.5) * 0.6;
  }
  return baseScore;
}

export const REWARD_BY_ACTION: Record<"SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT", number> = {
  SAVE: 1,
  UNSAVE: 0.25,
  SKIP: 0,
  CLICK_OUT: 1,
};
