import BrowseClient from "@/components/BrowseClient";
import { getCatalogPage, getCatalogAttributes } from "@/lib/repository";
import { parseCatalogQuery } from "@/lib/catalog-query";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) if (typeof value === "string") params.set(key, value);
  let query;
  try { query = parseCatalogQuery(params); } catch { return <p>Invalid catalog filters. <a href="/">Reset filters</a></p>; }
  const [page, attributes] = await Promise.all([getCatalogPage(query), getCatalogAttributes()]);
  return <BrowseClient products={page.products} brands={attributes.brands} query={query} nextCursor={page.nextCursor} />;
}
