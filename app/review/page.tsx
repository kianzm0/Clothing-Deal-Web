import { getAllProducts } from "@/lib/repository";
import ReviewClient from "@/components/ReviewClient";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const products = await getAllProducts();
  return <ReviewClient products={products.map(({ id, name, brand, category }) => ({ id, name, brand, category }))} />;
}
