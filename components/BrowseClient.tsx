"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CatalogQuery } from "@/lib/catalog-query";
import { Product } from "@/lib/types";
import { discountPct, daysSinceUpdate } from "@/lib/pricing";
import { rankProducts } from "@/lib/ranking";
import { recommendationOffer, totalPrice } from "@/lib/recommendation-offer";
import { usePreferences } from "@/lib/store";
import { useBandit } from "@/lib/useBandit";
import FilterBar, { DEFAULT_FILTERS, Filters } from "./FilterBar";
import ProductCard from "./ProductCard";
import RecommendationEvaluation from "./RecommendationEvaluation";

export default function BrowseClient({ products, brands, query, nextCursor }: { products: Product[]; brands: string[]; query: CatalogQuery; nextCursor: string | null }) {
  const router = useRouter();
  const initialFilters = { ...DEFAULT_FILTERS, category: query.category ?? "all" as const, brand: query.brand ?? "all", maxPrice: query.maxPrice, minDiscount: query.minDiscount };
  const [filters, setFilters] = useState<Filters>(initialFilters);
  useEffect(() => { setFilters(previous => ({ ...initialFilters, sort: previous.sort })); }, [query.category, query.brand, query.maxPrice, query.minDiscount]);
  const { prefs } = usePreferences();
  const bandit = useBandit();
  function catalogUrl(next: Filters, after?: string) {
    const params = new URLSearchParams({ maxPrice: String(next.maxPrice), minDiscount: String(next.minDiscount) });
    if (next.category !== "all") params.set("category", next.category);
    if (next.brand !== "all") params.set("brand", next.brand);
    if (after) params.set("after", after);
    return `/?${params}`;
  }
  function changeFilters(next: Filters) {
    setFilters(next);
    if (next.category !== filters.category || next.brand !== filters.brand || next.maxPrice !== filters.maxPrice || next.minDiscount !== filters.minDiscount) router.replace(catalogUrl(next));
  }

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
          Compare clothing prices across stores.
        </p>
      </div>

      <FilterBar filters={filters} brands={brands} onChange={changeFilters} />

      <p className="mb-3 text-sm text-ink-500">
        {results.length} results on this page
        {bandit.signedIn && filters.sort === "best-match" && (
          <span className="ml-2 text-xs font-medium text-brand-600">· learning from your activity</span>
        )}
      </p>

      {results.length === 0 && (
        <p className="rounded-2xl border border-ink-100 bg-white p-6 text-sm text-ink-500">
          No deals match right now. Try widening your filters or checking back for new offers.
        </p>
      )}
      <p className="mb-3 text-xs text-ink-500">Sorting and personalized ranking apply to this page of matching deals.</p>
      <RecommendationEvaluation
        viewKey={JSON.stringify(filters)}
        items={results.map(({ product }) => ({ productId: product.id, displayedTotal: totalPrice(recommendationOffer(product, prefs)!) }))}
        context={{ sort: filters.sort, personalized: bandit.signedIn,
          filtered: filters.category !== "all" || filters.brand !== "all" || filters.maxPrice !== DEFAULT_FILTERS.maxPrice || filters.minDiscount !== DEFAULT_FILTERS.minDiscount }}
      >
        {results.map(({ product: p, reasons }) => (
          <ProductCard key={p.id} product={p} onInteract={bandit.recordInteraction} prefs={prefs} reasons={reasons} />
        ))}
      </RecommendationEvaluation>
      <div className="mt-6 flex gap-4">{query.after && <Link href={catalogUrl(filters)}>First page</Link>}{nextCursor && <Link href={catalogUrl(filters, nextCursor)}>Next page</Link>}</div>
    </div>
  );
}


