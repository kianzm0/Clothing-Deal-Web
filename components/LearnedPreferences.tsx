"use client";
import { useMemo } from "react";
import { AttributeInsight, summarizeProfile } from "@/lib/preference-model";
import { useBandit } from "@/lib/useBandit";
import { Preferences } from "@/lib/types";

const KIND_LABEL: Record<AttributeInsight["kind"], string> = {
  brand: "Brand",
  category: "Category",
  color: "Color",
  price: "Price",
};

const PRICE_LABEL: Record<string, string> = {
  "under-25": "Under $25",
  "25-50": "$25–50",
  "50-100": "$50–100",
  "100-plus": "$100+",
};

function displayValue(a: AttributeInsight): string {
  return a.kind === "price" ? PRICE_LABEL[a.value] ?? a.value : a.value;
}

function AffinityRow({ insight }: { insight: AttributeInsight }) {
  const pct = Math.round(insight.affinity * 100);
  const positive = insight.affinity >= 0.5;
  return (
    <li className="flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-xs uppercase tracking-wide text-ink-400">{KIND_LABEL[insight.kind]}</span>
      <span className="min-w-0 flex-1 truncate font-medium text-ink-800">{displayValue(insight)}</span>
      <span className="h-1.5 w-24 shrink-0 overflow-hidden rounded-full bg-ink-100">
        <span
          className={`block h-full rounded-full ${positive ? "bg-brand-500" : "bg-ink-400"}`}
          style={{ width: `${positive ? pct : 100 - pct}%` }}
        />
      </span>
    </li>
  );
}

function SuggestionPill({ label, onAccept }: { label: string; onAccept: () => void }) {
  return (
    <button
      onClick={onAccept}
      className="rounded-full border border-dashed border-brand-400 px-3 py-1 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
    >
      + {label}
    </button>
  );
}

// What the implicit preference model (lib/preference-model.ts) has
// picked up from saves, skips and click-outs, shown back to the user
// so the learning is visible — and so they can promote a learned
// taste into an explicit preference with one click.
export default function LearnedPreferences({
  prefs,
  update,
}: {
  prefs: Preferences;
  update: (next: Partial<Preferences>) => void;
}) {
  const { signedIn, profile } = useBandit();
  const insights = useMemo(() => summarizeProfile(profile, prefs), [profile, prefs]);

  if (!signedIn) return null;

  const { suggestions } = insights;
  const hasSuggestions =
    suggestions.favoriteBrands.length > 0 ||
    suggestions.dislikedBrands.length > 0 ||
    suggestions.colors.length > 0 ||
    suggestions.maxBudget !== null;
  const hasSignal = insights.likes.length > 0 || insights.dislikes.length > 0;

  return (
    <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
      <h2 className="text-base font-semibold text-ink-900">Learned from your activity</h2>
      <p className="mb-4 mt-1 text-sm text-ink-500">
        Based on what you save, skip and click through to. Recent activity counts more than old activity.
      </p>

      {!hasSignal ? (
        <p className="text-sm text-ink-400">
          Nothing confident yet — save or dismiss a few more items and patterns will show up here.
        </p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {insights.likes.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">You tend to like</h3>
              <ul className="space-y-2">
                {insights.likes.slice(0, 6).map((a) => (
                  <AffinityRow key={`${a.kind}:${a.value}`} insight={a} />
                ))}
              </ul>
            </div>
          )}
          {insights.dislikes.length > 0 && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">You tend to pass on</h3>
              <ul className="space-y-2">
                {insights.dislikes.slice(0, 6).map((a) => (
                  <AffinityRow key={`${a.kind}:${a.value}`} insight={a} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {hasSuggestions && (
        <div className="mt-6 border-t border-ink-100 pt-5">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">Suggested updates</h3>
          <div className="flex flex-wrap gap-2">
            {suggestions.favoriteBrands.map((b) => (
              <SuggestionPill
                key={`fav:${b}`}
                label={`Favorite brand: ${b}`}
                onAccept={() =>
                  update({
                    favoriteBrands: [...prefs.favoriteBrands, b],
                    dislikedBrands: prefs.dislikedBrands.filter((x) => x !== b),
                  })
                }
              />
            ))}
            {suggestions.dislikedBrands.map((b) => (
              <SuggestionPill
                key={`dis:${b}`}
                label={`Disliked brand: ${b}`}
                onAccept={() =>
                  update({
                    dislikedBrands: [...prefs.dislikedBrands, b],
                    favoriteBrands: prefs.favoriteBrands.filter((x) => x !== b),
                  })
                }
              />
            ))}
            {suggestions.colors.map((c) => (
              <SuggestionPill key={`color:${c}`} label={`Color: ${c}`} onAccept={() => update({ colors: [...prefs.colors, c] })} />
            ))}
            {suggestions.maxBudget !== null && (
              <SuggestionPill
                label={`Max budget: $${suggestions.maxBudget}`}
                onAccept={() => update({ maxBudget: suggestions.maxBudget! })}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
