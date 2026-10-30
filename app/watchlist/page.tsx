import { getAllProducts } from "@/lib/repository";
import WatchlistClient from "@/components/WatchlistClient";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const products = await getAllProducts();
  return <WatchlistClient products={products} />;
}
