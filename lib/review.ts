import { Category } from "./types";

export const REVIEW_CATEGORIES: Category[] = ["t-shirt", "hoodie", "sweatshirt", "long-sleeve"];

export interface ReviewOverrides {
  name?: string;
  brand?: string;
  priceCents?: number;
  listPriceCents?: number;
  imageUrl?: string;
  availability?: "in_stock" | "out_of_stock" | "preorder" | "unknown";
  colors?: string[];
  sizes?: string[];
}

export function isCategory(value: unknown): value is Category {
  return typeof value === "string" && REVIEW_CATEGORIES.includes(value as Category);
}

export function cleanReviewText(value: unknown, field: string, required = false): string | undefined {
  if (value === undefined || value === null) {
    if (required) throw new Error(`${field} is required.`);
    return undefined;
  }
  const text = String(value).trim();
  if (!text) {
    if (required) throw new Error(`${field} is required.`);
    return undefined;
  }
  if (text.length > 300) throw new Error(`${field} is too long.`);
  return text;
}

export function parseReviewOverrides(input: unknown): ReviewOverrides {
  if (!input || typeof input !== "object") return {};
  const value = input as Record<string, unknown>;
  const result: ReviewOverrides = {};
  const name = cleanReviewText(value.name, "name");
  const brand = cleanReviewText(value.brand, "brand");
  const imageUrl = cleanReviewText(value.imageUrl, "imageUrl");
  const availability = cleanReviewText(value.availability, "availability") as ReviewOverrides["availability"];
  if (name) result.name = name;
  if (brand) result.brand = brand;
  if (imageUrl) {
    try { new URL(imageUrl); } catch { throw new Error("imageUrl must be a valid URL."); }
    result.imageUrl = imageUrl;
  }
  if (availability && !["in_stock", "out_of_stock", "preorder", "unknown"].includes(availability)) throw new Error("availability is invalid.");
  if (availability) result.availability = availability;
  for (const [key, target] of [["priceCents", "price"], ["listPriceCents", "list price"]] as const) {
    if (value[key] === undefined || value[key] === null || value[key] === "") continue;
    const number = Number(value[key]);
    if (!Number.isInteger(number) || number < 0 || number > 10_000_000) throw new Error(`${target} is invalid.`);
    result[key] = number;
  }
  for (const key of ["colors", "sizes"] as const) {
    if (value[key] === undefined) continue;
    if (!Array.isArray(value[key])) throw new Error(`${key} must be an array.`);
    const values = value[key].map((item) => cleanReviewText(item, key, true)!).filter(Boolean);
    if (values.length > 30) throw new Error(`${key} has too many values.`);
    result[key] = [...new Set(values)];
  }
  return result;
}

export function requireNewProductFields(category: unknown, deal: { title: string | null; brand: string | null }, overrides: ReviewOverrides) {
  if (!isCategory(category)) throw new Error("Choose a product category before publishing.");
  const name = overrides.name ?? deal.title;
  const brand = overrides.brand ?? deal.brand;
  if (!name?.trim()) throw new Error("A product name is required before publishing.");
  if (!brand?.trim()) throw new Error("A brand is required before publishing.");
  return { category, name: name.trim(), brand: brand.trim() };
}
