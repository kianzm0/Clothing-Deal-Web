import { getAllProducts } from "@/lib/repository";
import ReviewClient from "@/components/ReviewClient";
import { notFound, redirect } from "next/navigation";
import { getEditorialAccess } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  const access = await getEditorialAccess();
  if (!access.allowed) {
    if (access.status === 401) redirect("/login");
    notFound();
  }
  const products = await getAllProducts();
  return <ReviewClient products={products.map(({ id, name, brand, category }) => ({ id, name, brand, category }))} />;
}
