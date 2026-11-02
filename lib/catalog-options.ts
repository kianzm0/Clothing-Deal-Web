import type { Product } from "./types";

export interface CatalogAttributes {
  brands: string[];
  colors: string[];
  sizes: string[];
}

const sortedUnique = (values: string[]) => [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));

export function catalogAttributesFromProducts(products: Product[]): CatalogAttributes {
  return {
    brands: sortedUnique(products.map((product) => product.brand)),
    colors: sortedUnique(products.flatMap((product) => product.colors)),
    sizes: sortedUnique(products.flatMap((product) => product.sizes)),
  };
}

export function mergeSavedOptions(available: string[], saved: string[]): string[] {
  return sortedUnique([...available, ...saved]);
}
