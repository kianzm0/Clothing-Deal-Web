import { prisma } from "@/lib/prisma";
import ReviewClient from "@/components/ReviewClient";
import { notFound, redirect } from "next/navigation";
import { getEditorialAccess } from "@/lib/authorization";

export const dynamic = "force-dynamic";

export default async function ReviewPage({ searchParams = {} }: { searchParams?: { q?: string; after?: string } } = {}) {
  const access = await getEditorialAccess();
  if (!access.allowed) {
    if (access.status === 401) redirect("/login");
    notFound();
  }
  const q = typeof searchParams.q === "string" ? searchParams.q.slice(0, 100) : "";
  const after = typeof searchParams.after === "string" ? searchParams.after.slice(0, 200) : "";
  const rows = await prisma.product.findMany({ where: { id: { gt: after }, ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { brand: { contains: q, mode: "insensitive" as const } }] } : {}) },
    select: { id: true, name: true, brand: true, category: true }, orderBy: { id: "asc" }, take: 101 });
  const products = rows.slice(0,100).map(p => ({ ...p, category: p.category.toLowerCase().replace("_", "-") as import("@/lib/types").Category }));
  return <><form className="mb-4"><input aria-label="Search existing products" name="q" defaultValue={q} className="rounded border p-2" /><button className="ml-2">Search products</button></form>
    <ReviewClient products={products} />
    {rows.length > 100 && <a href={`?${new URLSearchParams({ q, after: products[99].id })}`}>Next products</a>}</>;
}

