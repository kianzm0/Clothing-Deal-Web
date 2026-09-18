"use client";
import { PRODUCTS } from "@/lib/data";
import { useWatchlist } from "@/lib/store";
import ProductCard from "@/components/ProductCard";

export default function WatchlistPage() {
  const { ids, hydrated } = useWatchlist();
  const saved = PRODUCTS.filter((p) => ids.includes(p.id));

  if (!hydrated) return null;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Your watchlist</h1>
      <p className="mb-6 text-sm text-ink-500">Items you've saved to keep an eye on.</p>

      {saved.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-ink-200 bg-white/50 p-10 text-center text-sm text-ink-400">
          Nothing saved yet — browse and tap ♡ on any item.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
