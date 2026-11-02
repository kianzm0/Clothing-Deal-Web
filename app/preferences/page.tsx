"use client";
import { useEffect, useState } from "react";
import { usePreferences } from "@/lib/store";
import { CatalogAttributes, mergeSavedOptions } from "@/lib/catalog-options";
import LearnedPreferences from "@/components/LearnedPreferences";

const EMPTY_CATALOG: CatalogAttributes = { brands: [], colors: [], sizes: [] };

function toggleInList(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

function Pill({ active, unavailable, onClick, children }: { active: boolean; unavailable?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-label={unavailable ? `${children} (saved, currently unavailable)` : undefined}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${
        active
          ? "border-brand-500 bg-brand-500 text-white"
          : "border-ink-200 bg-white text-ink-600 hover:border-ink-300"
      }`}
    >
      {children}{unavailable && <span className="ml-1 text-xs opacity-80">(saved)</span>}
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

function Options({ available, selected, onToggle }: { available: string[]; selected: string[]; onToggle: (value: string) => void }) {
  const values = mergeSavedOptions(available, selected);
  if (values.length === 0) return <p className="text-sm text-ink-400">No catalog options are currently available.</p>;
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Pill
          key={value}
          active={selected.includes(value)}
          unavailable={!available.includes(value)}
          onClick={() => onToggle(value)}
        >
          {value}
        </Pill>
      ))}
    </div>
  );
}

export default function PreferencesPage() {
  const { prefs, update, hydrated, error, retry } = usePreferences();
  const [catalog, setCatalog] = useState<CatalogAttributes>(EMPTY_CATALOG);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [catalogRetry, setCatalogRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogLoading(true);
    setCatalogError(null);
    fetch("/api/catalog/attributes", { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog options are temporarily unavailable.");
        return response.json() as Promise<CatalogAttributes>;
      })
      .then((attributes) => setCatalog(attributes))
      .catch((reason: unknown) => {
        if (reason instanceof DOMException && reason.name === "AbortError") return;
        setCatalogError(reason instanceof Error ? reason.message : "Catalog options are temporarily unavailable.");
        setCatalog(EMPTY_CATALOG);
      })
      .finally(() => setCatalogLoading(false));
    return () => controller.abort();
  }, [catalogRetry]);

  if (!hydrated) return <p role={error ? "alert" : "status"}>{error ?? "Loading preferences…"} {error && <button onClick={retry}>Retry</button>}</p>;

  return (
    <div className="max-w-2xl">
      <h1 className="mb-1 text-2xl font-bold tracking-tight text-ink-900 sm:text-3xl">Preferences</h1>
      <p className="mb-6 text-sm text-ink-500">
        These drive the "Best match" sort on the browse page. When you're signed in, it also learns from what you save and skip.
      </p>

      {error && <p role="alert">{error} <button onClick={retry}>Retry</button></p>}
      {catalogError && (
        <p role="alert">
          {catalogError} <button onClick={() => setCatalogRetry((value) => value + 1)}>Retry catalog</button>
        </p>
      )}
      {catalogLoading && <p role="status">Loading catalog options…</p>}
      <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
        <Section title="Sizes">
          <Options available={catalog.sizes} selected={prefs.sizes} onToggle={(value) => update({ sizes: toggleInList(prefs.sizes, value) })} />
        </Section>

        <Section title="Favorite brands">
          <Options available={catalog.brands} selected={prefs.favoriteBrands} onToggle={(value) => update({ favoriteBrands: toggleInList(prefs.favoriteBrands, value) })} />
        </Section>

        <Section title="Disliked brands">
          <Options available={catalog.brands} selected={prefs.dislikedBrands} onToggle={(value) => update({ dislikedBrands: toggleInList(prefs.dislikedBrands, value) })} />
        </Section>

        <Section title="Colors">
          <Options available={catalog.colors} selected={prefs.colors} onToggle={(value) => update({ colors: toggleInList(prefs.colors, value) })} />
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

      <LearnedPreferences prefs={prefs} update={update} />
    </div>
  );
}
