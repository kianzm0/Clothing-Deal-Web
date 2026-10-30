"use client";
import { useWatchlist } from "@/lib/store";
import type { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

export default function WatchlistClient({ products }: { products: Product[] }) {
  const watchlist = useWatchlist();
  const { ids, hydrated, toggle } = watchlist;
  const byId = new Map(products.filter((p) => p.offers.length > 0).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Your watchlist</h1>
      <p className="mb-6 text-sm text-ink-500">Items you've saved to keep an eye on.</p>
      {!hydrated ? (
        <p role="status" className="text-sm text-ink-500">Loading your watchlist…</p>
      ) : ids.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/50 p-10 text-center text-sm text-ink-400">
          Nothing saved yet — browse and tap ♡ on any item.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {[...new Set(ids)].map((id) => {
            const product = byId.get(id);
            return product ? (
              <ProductCard key={id} product={product} watchlist={watchlist} />
            ) : (
              <div key={id} className="rounded-2xl border border-dashed border-ink-200 bg-white/50 p-6 text-sm text-ink-500">
                <p>This saved product is currently unavailable.</p>
                <p className="mt-2">Keep it saved to check again later, or remove it.</p>
                <button onClick={() => toggle(id)} className="mt-4 font-medium text-brand-600">
                  Remove from watchlist
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
