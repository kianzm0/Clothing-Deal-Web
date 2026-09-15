import { getAllProducts } from "@/lib/repository";
import BrowseClient from "@/components/BrowseClient";

export default async function HomePage() {
  const products = await getAllProducts();
  return <BrowseClient products={products} />;
}
