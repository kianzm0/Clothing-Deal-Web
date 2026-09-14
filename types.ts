export type Category = "t-shirt" | "hoodie" | "sweatshirt" | "long-sleeve";

export interface Offer {
  store: string;
  price: number;
  originalPrice: number;
  shippingCost: number;
  sizesInStock: string[];
  lastUpdated: string; // ISO date
  url: string;
}

export interface Product {
  id: string;
  name: string;
  brand: string;
  category: Category;
  colors: string[];
  sizes: string[];
  image: string;
  offers: Offer[];
}

export interface Preferences {
  sizes: string[];
  favoriteBrands: string[];
  dislikedBrands: string[];
  colors: string[];
  fits: string[];
  maxBudget: number;
  minDiscountPct: number;
}

export const DEFAULT_PREFERENCES: Preferences = {
  sizes: [],
  favoriteBrands: [],
  dislikedBrands: [],
  colors: [],
  fits: [],
  maxBudget: 200,
  minDiscountPct: 0,
};

export type SortOption = "best-match" | "lowest-price" | "biggest-discount" | "freshest";
