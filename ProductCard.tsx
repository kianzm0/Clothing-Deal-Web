"use client";
import { useState } from "react";
import Link from "next/link";
import { Preferences, Product } from "@/lib/types";
import { bestOffer, discountPct } from "@/lib/pricing";
import { useWatchlist } from "@/lib/store";

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
      <div className="flex items-center justify-center rounded-lg border border-dashed border-gray-200 p-4 text-xs text-gray-400">
        Hidden — thanks, that helps future picks.
      </div>
    );
  }

  return (
    <div className="group relative rounded-lg border border-gray-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="absolute right-3 top-3 flex gap-1">
        <button
          onClick={handleSkip}
          aria-label="Not interested"
          title="Not interested"
          className="rounded-full border border-gray-300 px-2 py-1 text-xs text-gray-400 hover:border-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
        <button
          onClick={handleToggleSave}
          aria-label={saved ? "Remove from watchlist" : "Save to watchlist"}
          className={`rounded-full border px-2 py-1 text-xs font-medium ${
            saved ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-500"
          }`}
        >
          {saved ? "Saved" : "Save"}
        </button>
      </div>
      <Link href={`/product/${product.id}`}>
        <div className="mb-3 flex h-32 items-center justify-center rounded bg-gray-100 text-3xl">
          👕
        </div>
        <p className="text-xs uppercase text-gray-500">{product.brand}</p>
        <h3 className="font-semibold">{product.name}</h3>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-lg font-bold">${offer.price}</span>
          {discount > 0 && (
            <>
              <span className="text-sm text-gray-400 line-through">${offer.originalPrice}</span>
              <span className="text-sm font-medium text-emerald-600">-{discount}%</span>
            </>
          )}
        </div>
        <p className="mt-1 text-xs text-gray-500">Best at {offer.store}</p>
      </Link>
    </div>
  );
}
