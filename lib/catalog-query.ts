import { AccountInputError } from "./account-input";
import { Category } from "./types";
export const CATALOG_PAGE_SIZE = 48;
export interface CatalogQuery { after?: string; category?: Category; brand?: string; maxPrice: number; minDiscount: number; }
export function parseCatalogQuery(params: URLSearchParams): CatalogQuery {
  const after = params.get("after") || undefined, brand = params.get("brand") || undefined, category = params.get("category") || undefined;
  if ((after?.length ?? 0) > 200 || (brand?.length ?? 0) > 100) throw new AccountInputError("Invalid catalog filter.");
  if (category && !["t-shirt", "hoodie", "sweatshirt", "long-sleeve"].includes(category)) throw new AccountInputError("Invalid category.");
  const maxPrice = Number(params.get("maxPrice") ?? 200), minDiscount = Number(params.get("minDiscount") ?? 0);
  if (!Number.isFinite(maxPrice) || maxPrice < 0 || maxPrice > 100000 || !Number.isFinite(minDiscount) || minDiscount < 0 || minDiscount > 100) throw new AccountInputError("Invalid price or discount.");
  return { after, brand, category: category as Category | undefined, maxPrice, minDiscount };
}
