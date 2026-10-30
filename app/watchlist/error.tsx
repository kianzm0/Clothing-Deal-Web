"use client";

export default function WatchlistError({ reset }: { reset: () => void }) {
  return (
    <div role="alert" className="rounded-2xl border border-ink-200 p-6">
      <h1 className="text-xl font-bold">Unable to load your watchlist</h1>
      <p className="mt-2">The catalog could not be loaded. Your saved items have not been removed.</p>
      <button onClick={reset} className="mt-4 font-medium text-brand-600">Try again</button>
    </div>
  );
}
