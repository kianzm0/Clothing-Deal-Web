"use client";
import { useEffect, useState } from "react";
import { useWatchlist } from "@/lib/store";
import type { Product } from "@/lib/types";
import ProductCard from "@/components/ProductCard";

export default function WatchlistClient({ products, loadSavedProducts = false }: { products: Product[]; loadSavedProducts?: boolean }) {
  const watchlist = useWatchlist();
  const { ids, hydrated, toggle } = watchlist;
  const [loaded, setLoaded] = useState<{ key: string; products: Product[] }>({ key: "", products: [] });
  const [loadError, setLoadError] = useState(false), [retry, setRetry] = useState(0);
  const idsKey = JSON.stringify([...new Set(ids)].sort());
  useEffect(() => {
    if (!loadSavedProducts || !hydrated) return;
    const abort = new AbortController(); let active = true; setLoadError(false);
    async function load() {
      const saved = JSON.parse(idsKey) as string[], all: Product[] = [];
      for (let i = 0; i < saved.length; i += 100) {
        const res = await fetch("/api/catalog/lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids: saved.slice(i, i + 100) }), signal: abort.signal });
        if (!res.ok) throw new Error();
        all.push(...(await res.json()).products);
      }
      if (active) setLoaded({ key: idsKey, products: all });
    }
    void load().catch(() => { if (active) setLoadError(true); });
    return () => { active = false; abort.abort(); };
  }, [loadSavedProducts, hydrated, idsKey, retry]);
  const waiting = loadSavedProducts && loaded.key !== idsKey;
  const currentProducts = loadSavedProducts ? (waiting ? [] : loaded.products) : products;
  const byId = new Map(currentProducts.filter((p) => p.offers.length > 0).map((p) => [p.id, p]));

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Your watchlist</h1>
      <p className="mb-6 text-sm text-ink-500">Items you've saved to keep an eye on.</p>
      {watchlist.error && <p role="alert">{watchlist.error} <button onClick={watchlist.retry}>Retry</button></p>}
      {loadError ? <p role="alert">Could not load saved products. <button onClick={() => setRetry(n => n + 1)}>Retry</button></p> : !hydrated || waiting ? (
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


