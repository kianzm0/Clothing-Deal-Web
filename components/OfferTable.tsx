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
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-gray-500">
          <tr>
            <th className="px-4 py-2">Store</th>
            <th className="px-4 py-2">Price</th>
            <th className="px-4 py-2">Shipping</th>
            <th className="px-4 py-2">Sizes in stock</th>
            <th className="px-4 py-2">Updated</th>
            <th className="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {offers.map((offer, i) => (
            <tr key={offer.store} className={i === 0 ? "bg-emerald-50" : "border-t border-gray-100"}>
              <td className="px-4 py-3 font-medium">{offer.store}</td>
              <td className="px-4 py-3">
                ${offer.price}
                {discountPct(offer) > 0 && (
                  <span className="ml-2 text-xs font-medium text-emerald-600">-{discountPct(offer)}%</span>
                )}
              </td>
              <td className="px-4 py-3">{offer.shippingCost === 0 ? "Free" : `$${offer.shippingCost}`}</td>
              <td className="px-4 py-3">{offer.sizesInStock.join(", ")}</td>
              <td className="px-4 py-3 text-gray-500">{daysSinceUpdate(offer)}d ago</td>
              <td className="px-4 py-3">
                <a href={offer.url} onClick={handleClickOut} className="text-brand-600 hover:underline">
                  View →
                </a>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
