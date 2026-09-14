"use client";
import { Category, SortOption } from "@/lib/types";

export interface Filters {
  category: Category | "all";
  brand: string;
  maxPrice: number;
  minDiscount: number;
  sort: SortOption;
}

export const DEFAULT_FILTERS: Filters = {
  category: "all",
  brand: "all",
  maxPrice: 200,
  minDiscount: 0,
  sort: "best-match",
};

export default function FilterBar({
  filters,
  brands,
  onChange,
}: {
  filters: Filters;
  brands: string[];
  onChange: (next: Filters) => void;
}) {
  return (
    <div className="mb-6 flex flex-wrap gap-3 rounded-lg border border-gray-200 bg-white p-4">
      <select
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        value={filters.category}
        onChange={(e) => onChange({ ...filters, category: e.target.value as Filters["category"] })}
      >
        <option value="all">All categories</option>
        <option value="t-shirt">T-Shirts</option>
        <option value="hoodie">Hoodies</option>
        <option value="sweatshirt">Sweatshirts</option>
        <option value="long-sleeve">Long Sleeves</option>
      </select>

      <select
        className="rounded border border-gray-300 px-2 py-1 text-sm"
        value={filters.brand}
        onChange={(e) => onChange({ ...filters, brand: e.target.value })}
      >
        <option value="all">All brands</option>
        {brands.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Max $
        <input
          type="number"
          className="w-20 rounded border border-gray-300 px-2 py-1"
          value={filters.maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        Min discount %
        <input
          type="number"
          className="w-16 rounded border border-gray-300 px-2 py-1"
          value={filters.minDiscount}
          onChange={(e) => onChange({ ...filters, minDiscount: Number(e.target.value) })}
        />
      </label>

      <select
        className="ml-auto rounded border border-gray-300 px-2 py-1 text-sm"
        value={filters.sort}
        onChange={(e) => onChange({ ...filters, sort: e.target.value as SortOption })}
      >
        <option value="best-match">Best match</option>
        <option value="lowest-price">Lowest price</option>
        <option value="biggest-discount">Biggest discount</option>
        <option value="freshest">Freshest update</option>
      </select>
    </div>
  );
}
