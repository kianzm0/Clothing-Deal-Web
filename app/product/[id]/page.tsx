import Link from "next/link";
import { getProductById } from "@/lib/repository";
import { notFound } from "next/navigation";
import OfferTable from "@/components/OfferTable";
import { CATEGORY_GLYPH, CATEGORY_LABEL } from "@/lib/category";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);
  if (!product) return notFound();

  const offers = [...product.offers].sort((a, b) => a.price + a.shippingCost - (b.price + b.shippingCost));

  return (
    <div>
      <Link href="/" className="mb-4 inline-flex items-center gap-1 text-sm text-ink-500 hover:text-ink-900">
        ← Back to browse
      </Link>

      <div className="grid gap-8 sm:grid-cols-[16rem,1fr]">
        <div className="flex h-64 items-center justify-center rounded-2xl border border-ink-100 bg-gradient-to-br from-ink-50 to-brand-50 text-6xl">
          {CATEGORY_GLYPH[product.category]}
        </div>

        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-ink-400">
            {product.brand} · {CATEGORY_LABEL[product.category]}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink-900">{product.name}</h1>
          <p className="mt-2 text-sm text-ink-500">
            Sizes: <span className="text-ink-700">{product.sizes.join(", ")}</span>
            <span className="mx-2 text-ink-200">·</span>
            Colors: <span className="text-ink-700">{product.colors.join(", ")}</span>
          </p>

          <h2 className="mb-3 mt-8 text-sm font-semibold uppercase tracking-wide text-ink-400">
            Compare {offers.length} offer{offers.length === 1 ? "" : "s"}
          </h2>
          <OfferTable product={product} offers={offers} />
        </div>
      </div>
    </div>
  );
}
