"use client";
import { usePreferences } from "@/lib/store";
import { PRODUCTS } from "@/lib/data";

const ALL_BRANDS = Array.from(new Set(PRODUCTS.map((p) => p.brand))).sort();
const ALL_COLORS = Array.from(new Set(PRODUCTS.flatMap((p) => p.colors))).sort();
const ALL_SIZES = Array.from(new Set(PRODUCTS.flatMap((p) => p.sizes))).sort();

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Pill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-sm ${
        active ? "border-brand-500 bg-brand-50 text-brand-700" : "border-gray-300 text-gray-600"
      }`}
    >
      {children}
    </button>
  );
}

export default function PreferencesPage() {
  const { prefs, update, hydrated } = usePreferences();
  if (!hydrated) return null;

  return (
    <div className="max-w-lg">
      <h1 className="mb-4 text-2xl font-bold">Preferences</h1>
      <p className="mb-6 text-sm text-gray-500">
        These drive the rule-based "Best match" sort on the browse page.
      </p>

      <section className="mb-5">
        <h2 className="mb-2 font-semibold">Sizes</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_SIZES.map((s) => (
            <Pill key={s} active={prefs.sizes.includes(s)} onClick={() => update({ sizes: toggleInList(prefs.sizes, s) })}>
              {s}
            </Pill>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 font-semibold">Favorite brands</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_BRANDS.map((b) => (
            <Pill key={b} active={prefs.favoriteBrands.includes(b)} onClick={() => update({ favoriteBrands: toggleInList(prefs.favoriteBrands, b) })}>
              {b}
            </Pill>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 font-semibold">Disliked brands</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_BRANDS.map((b) => (
            <Pill key={b} active={prefs.dislikedBrands.includes(b)} onClick={() => update({ dislikedBrands: toggleInList(prefs.dislikedBrands, b) })}>
              {b}
            </Pill>
          ))}
        </div>
      </section>

      <section className="mb-5">
        <h2 className="mb-2 font-semibold">Colors</h2>
        <div className="flex flex-wrap gap-2">
          {ALL_COLORS.map((c) => (
            <Pill key={c} active={prefs.colors.includes(c)} onClick={() => update({ colors: toggleInList(prefs.colors, c) })}>
              {c}
            </Pill>
          ))}
        </div>
      </section>

      <section className="mb-5 flex gap-6">
        <label className="text-sm">
          Max budget ($)
          <input
            type="number"
            className="mt-1 block w-28 rounded border border-gray-300 px-2 py-1"
            value={prefs.maxBudget}
            onChange={(e) => update({ maxBudget: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          Min discount (%)
          <input
            type="number"
            className="mt-1 block w-28 rounded border border-gray-300 px-2 py-1"
            value={prefs.minDiscountPct}
            onChange={(e) => update({ minDiscountPct: Number(e.target.value) })}
          />
        </label>
      </section>
    </div>
  );
}
