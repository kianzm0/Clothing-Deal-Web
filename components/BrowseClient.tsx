"use client";
import { useMemo, useState } from "react";
import { Product } from "@/lib/types";
import { bestOffer, discountPct, daysSinceUpdate } from "@/lib/pricing";
import { scoreProduct as ruleBasedScore } from "@/lib/recommend";
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
      const offer = bestOffer(p);
      if (filters.category !== "all" && p.category !== filters.category) return false;
      if (filters.brand !== "all" && p.brand !== filters.brand) return false;
      if (offer.price > filters.maxPrice) return false;
      if (discountPct(offer) < filters.minDiscount) return false;
      return true;
    });

    switch (filters.sort) {
      case "lowest-price":
        list = [...list].sort((a, b) => bestOffer(a).price - bestOffer(b).price);
        break;
      case "biggest-discount":
        list = [...list].sort((a, b) => discountPct(bestOffer(b)) - discountPct(bestOffer(a)));
        break;
      case "freshest":
        list = [...list].sort((a, b) => daysSinceUpdate(bestOffer(a)) - daysSinceUpdate(bestOffer(b)));
        break;
      default:
        // Best match: the learned bandit model when signed in (it
        // already incorporates preferences via the same feature
        // vector), the deterministic rule-based score otherwise.
        list = bandit.signedIn
          ? [...list].sort((a, b) => bandit.scoreProduct(b, prefs) - bandit.scoreProduct(a, prefs))
          : [...list].sort((a, b) => ruleBasedScore(b, prefs) - ruleBasedScore(a, prefs));
    }
    return list;
  }, [products, filters, prefs, bandit]);

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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((p) => (
          <ProductCard key={p.id} product={p} onInteract={bandit.recordInteraction} prefs={prefs} />
        ))}
      </div>
    </div>
  );
}
