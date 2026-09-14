import { getProductById } from "@/lib/repository";
import { notFound } from "next/navigation";
import OfferTable from "@/components/OfferTable";

export default async function ProductPage({ params }: { params: { id: string } }) {
  const product = await getProductById(params.id);
  if (!product) return notFound();

  const offers = [...product.offers].sort((a, b) => a.price + a.shippingCost - (b.price + b.shippingCost));

  return (
    <div>
      <p className="text-xs uppercase text-gray-500">{product.brand}</p>
      <h1 className="mb-1 text-2xl font-bold">{product.name}</h1>
      <p className="mb-6 text-sm text-gray-500">
        Sizes: {product.sizes.join(", ")} · Colors: {product.colors.join(", ")}
      </p>

      <div className="mb-3 flex h-48 items-center justify-center rounded bg-gray-100 text-5xl">
        👕
      </div>

      <h2 className="mb-2 font-semibold">Compare offers</h2>
      <OfferTable product={product} offers={offers} />
    </div>
  );
}
