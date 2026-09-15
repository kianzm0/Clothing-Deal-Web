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
      <h1 className="mb-4 text-2xl font-bold">Your Watchlist</h1>
      {saved.length === 0 ? (
        <p className="text-gray-500">Nothing saved yet — browse and tap "Save" on any item.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {saved.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
