"use client";
import { Offer, Preferences, Product } from "@/lib/types";
import { discountPct, daysSinceUpdate } from "@/lib/pricing";
import { usePreferences } from "@/lib/store";
import { useBandit } from "@/lib/useBandit";

export default function OfferTable({ product, offers }: { product: Product; offers: Offer[] }) {
  const { prefs } = usePreferences();
  const bandit = useBandit();

  // Click-through to an actual store is the strongest available
  // signal that the recommendation worked — fire-and-forget so it
  // never delays the navigation itself.
  function handleClickOut() {
    bandit.recordInteraction(product.id, "CLICK_OUT", prefs);
  }

  return (
    <div className="space-y-2.5">
      {offers.map((offer, i) => {
        const isBest = i === 0;
        const discount = discountPct(offer);
        return (
          <div
            key={offer.store}
            className={`flex flex-wrap items-center gap-x-6 gap-y-2 rounded-2xl border p-4 transition ${
              isBest ? "border-brand-200 bg-brand-50/60 shadow-card" : "border-ink-100 bg-white"
            }`}
          >
            <div className="min-w-[7rem]">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-ink-900">{offer.store}</span>
                {isBest && (
                  <span className="rounded-full bg-brand-500 px-2 py-0.5 text-xs font-semibold text-white">
                    Best price
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-ink-400">Updated {daysSinceUpdate(offer)}d ago</p>
            </div>

            <div className="flex items-baseline gap-2">
              <span className="text-lg font-bold text-ink-900">${offer.price}</span>
              {discount > 0 && (
                <>
                  <span className="text-sm text-ink-300 line-through">${offer.originalPrice}</span>
                  <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-xs font-semibold text-emerald-700">
                    -{discount}%
                  </span>
                </>
              )}
            </div>

            <div className="text-sm text-ink-500">
              {offer.shippingCost === 0 ? (
                <span className="font-medium text-emerald-700">Free shipping</span>
              ) : (
                `$${offer.shippingCost} shipping`
              )}
            </div>

            <div className="text-sm text-ink-500">
              Sizes: <span className="text-ink-700">{offer.sizesInStock.join(", ") || "—"}</span>
            </div>

            <a
              href={offer.url}
              onClick={handleClickOut}
              className="ml-auto rounded-full bg-ink-900 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-ink-800"
            >
              View deal →
            </a>
          </div>
        );
      })}
    </div>
  );
}
