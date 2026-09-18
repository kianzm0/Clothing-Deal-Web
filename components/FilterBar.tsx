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

const selectClass =
  "rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-800 shadow-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

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
    <div className="mb-6 flex flex-wrap items-center gap-2.5 rounded-2xl border border-ink-100 bg-white/60 p-3.5 shadow-card">
      <select
        className={selectClass}
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
        className={selectClass}
        value={filters.brand}
        onChange={(e) => onChange({ ...filters, brand: e.target.value })}
      >
        <option value="all">All brands</option>
        {brands.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <label className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-600 shadow-sm">
        Max
        <input
          type="number"
          className="w-16 bg-transparent text-ink-900 outline-none"
          value={filters.maxPrice}
          onChange={(e) => onChange({ ...filters, maxPrice: Number(e.target.value) })}
        />
      </label>

      <label className="flex items-center gap-2 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm text-ink-600 shadow-sm">
        Min off
        <input
          type="number"
          className="w-12 bg-transparent text-ink-900 outline-none"
          value={filters.minDiscount}
          onChange={(e) => onChange({ ...filters, minDiscount: Number(e.target.value) })}
        />
        %
      </label>

      <select
        className={`${selectClass} ml-auto font-medium`}
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
