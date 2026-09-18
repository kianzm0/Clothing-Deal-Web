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
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
      }`}
    >
      {children}
    </button>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-ink-100 py-5 first:pt-0 last:border-0">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-400">{title}</h2>
      {children}
    </section>
  );
}

export default function PreferencesPage() {
  const { prefs, update, hydrated } = usePreferences();
  if (!hydrated) return null;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Preferences</h1>
      <p className="mb-6 text-sm text-ink-500">
        These drive the rule-based "Best match" sort on the browse page.
      </p>

      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <Section title="Sizes">
          <div className="flex flex-wrap gap-2">
            {ALL_SIZES.map((s) => (
              <Pill key={s} active={prefs.sizes.includes(s)} onClick={() => update({ sizes: toggleInList(prefs.sizes, s) })}>
                {s}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="Favorite brands">
          <div className="flex flex-wrap gap-2">
            {ALL_BRANDS.map((b) => (
              <Pill key={b} active={prefs.favoriteBrands.includes(b)} onClick={() => update({ favoriteBrands: toggleInList(prefs.favoriteBrands, b) })}>
                {b}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="Disliked brands">
          <div className="flex flex-wrap gap-2">
            {ALL_BRANDS.map((b) => (
              <Pill key={b} active={prefs.dislikedBrands.includes(b)} onClick={() => update({ dislikedBrands: toggleInList(prefs.dislikedBrands, b) })}>
                {b}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="Colors">
          <div className="flex flex-wrap gap-2">
            {ALL_COLORS.map((c) => (
              <Pill key={c} active={prefs.colors.includes(c)} onClick={() => update({ colors: toggleInList(prefs.colors, c) })}>
                {c}
              </Pill>
            ))}
          </div>
        </Section>

        <Section title="Budget & discount">
          <div className="flex gap-8">
            <label className="text-sm text-ink-600">
              Max budget ($)
              <input
                type="number"
                className="mt-1.5 block w-28 rounded-lg border border-ink-200 px-3 py-1.5 text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                value={prefs.maxBudget}
                onChange={(e) => update({ maxBudget: Number(e.target.value) })}
              />
            </label>
            <label className="text-sm text-ink-600">
              Min discount (%)
              <input
                type="number"
                className="mt-1.5 block w-28 rounded-lg border border-ink-200 px-3 py-1.5 text-ink-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
                value={prefs.minDiscountPct}
                onChange={(e) => update({ minDiscountPct: Number(e.target.value) })}
              />
            </label>
          </div>
        </Section>
      </div>
    </div>
  );
}
