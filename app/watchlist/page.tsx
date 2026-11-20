import WatchlistClient from "@/components/WatchlistClient";
export const dynamic = "force-dynamic";
export default async function WatchlistPage() {
  return <WatchlistClient products={[]} loadSavedProducts />;
}
