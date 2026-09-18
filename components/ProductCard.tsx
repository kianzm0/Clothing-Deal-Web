"use client";
import { useState } from "react";
import Link from "next/link";
import { Preferences, Product } from "@/lib/types";
import { bestOffer, discountPct } from "@/lib/pricing";
import { useWatchlist } from "@/lib/store";
import { CATEGORY_GLYPH } from "@/lib/category";

type InteractionAction = "SAVE" | "UNSAVE" | "SKIP" | "CLICK_OUT";

export default function ProductCard({
  product,
  onInteract,
  prefs,
}: {
  product: Product;
  onInteract?: (productId: string, action: InteractionAction, prefs: Preferences) => void;
  prefs?: Preferences;
}) {
  const offer = bestOffer(product);
  const discount = discountPct(offer);
  const { ids, toggle, hydrated } = useWatchlist();
  const saved = hydrated && ids.includes(product.id);
  const [skipped, setSkipped] = useState(false);

  function handleToggleSave() {
    const willBeSaved = !saved;
    toggle(product.id);
    if (onInteract && prefs) {
      onInteract(product.id, willBeSaved ? "SAVE" : "UNSAVE", prefs);
    }
  }

  function handleSkip() {
    setSkipped(true);
    if (onInteract && prefs) {
      onInteract(product.id, "SKIP", prefs);
    }
  }

  // "Not interested" hides the card for the rest of this session —
  // it's the bandit's only source of explicit negative signal, so
  // we act on it visually too rather than just logging it silently.
  if (skipped) {
    return (
      <div className="flex items-center justify-center rounded-2xl border border-dashed border-ink-200 p-6 text-xs text-ink-400">
        Hidden — thanks, that helps future picks.
      </div>
    );
  }

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
      <div className="absolute right-3 top-3 z-10 flex gap-1.5">
        <button
          onClick={handleSkip}
          aria-label="Not interested"
          title="Not interested"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink-400 shadow-sm backdrop-blur transition hover:text-ink-700"
        >
          ✕
        </button>
        <button
          onClick={handleToggleSave}
          aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
          className={`flex h-7 w-7 items-center justify-center rounded-full shadow-sm backdrop-blur transition ${
            saved ? "bg-brand-500 text-white" : "bg-white/90 text-ink-400 hover:text-brand-500"
          }`}
        >
          {saved ? "♥" : "♡"}
        </button>
      </div>

      <Link href={`/product/${product.id}`}>
        <div className="relative flex h-36 items-center justify-center bg-gradient-to-br from-ink-50 to-brand-50 text-4xl">
          {CATEGORY_GLYPH[product.category]}
          {discount > 0 && (
            <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-xs font-semibold text-white">
              -{discount}%
            </span>
          )}
        </div>
        <div className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{product.brand}</p>
          <h3 className="mt-0.5 truncate font-semibold text-ink-900">{product.name}</h3>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-ink-900">${offer.price}</span>
            {discount > 0 && (
              <span className="text-sm text-ink-300 line-through">${offer.originalPrice}</span>
            )}
          </div>
          <p className="mt-1 text-xs text-ink-400">Best at {offer.store}</p>
        </div>
      </Link>
    </div>
  );
}
