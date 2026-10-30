"use client";
import { useMemo, useState } from "react";
import { Product } from "@/lib/types";
import { discountPct, daysSinceUpdate } from "@/lib/pricing";
import { rankProducts } from "@/lib/ranking";
import { recommendationOffer, totalPrice } from "@/lib/recommendation-offer";
import { usePreferences } from "@/lib/store";
import { useBandit } from "@/lib/useBandit";
import FilterBar, { DEFAULT_FILTERS, Filters } from "./FilterBar";
import ProductCard from "./ProductCard";

export default function BrowseClient({ products }: { products: Product[] }) {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const { prefs } = usePreferences();
  const bandit = useBandit();

  const brands = useMemo(
    () => Array.from(new Set(products.map((p) => p.brand))).sort(),
    [products]
  );

  const results = useMemo(() => {
    let list = products.filter((p) => {
      if (bandit.profile.dismissed?.includes(p.id)) return false;
      const offer = recommendationOffer(p, prefs);
      if (!offer) return false;
      if (filters.category !== "all" && p.category !== filters.category) return false;
      if (filters.brand !== "all" && p.brand !== filters.brand) return false;
      if (totalPrice(offer) > filters.maxPrice) return false;
      if (discountPct(offer) < filters.minDiscount) return false;
      return true;
    });

    switch (filters.sort) {
      case "lowest-price":
        list = [...list].sort((a, b) => totalPrice(recommendationOffer(a, prefs)!) - totalPrice(recommendationOffer(b, prefs)!));
        break;
      case "biggest-discount":
        list = [...list].sort((a, b) => discountPct(recommendationOffer(b, prefs)!) - discountPct(recommendationOffer(a, prefs)!));
        break;
      case "freshest":
        list = [...list].sort((a, b) => daysSinceUpdate(recommendationOffer(a, prefs)!) - daysSinceUpdate(recommendationOffer(b, prefs)!));
        break;
      default:
        return rankProducts(list, prefs, bandit.weights, bandit.profile);
    }
    return list.map(product => ({ product, reasons: [] as string[] }));
  }, [products, filters, prefs, bandit.weights, bandit.profile]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">
          Today's best clothing deals
        </h1>
        <p className="mt-1 text-sm text-ink-500">
          Prices compared across stores, updated continuously.
        </p>
      </div>

      <FilterBar filters={filters} brands={brands} onChange={setFilters} />

      <p className="mb-3 text-sm text-ink-500">
        {results.length} results
        {bandit.signedIn && filters.sort === "best-match" && (
          <span className="ml-2 text-xs font-medium text-brand-600">· learning from your activity</span>
        )}
      </p>

      {results.length === 0 && (
        <p className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-500">
          No deals match right now. Try widening your filters or checking back for new offers.
        </p>
      )}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {results.map(({ product: p, reasons }) => (
          <ProductCard key={p.id} product={p} onInteract={bandit.recordInteraction} prefs={prefs} reasons={reasons} />
        ))}
      </div>
    </div>
  );
}
