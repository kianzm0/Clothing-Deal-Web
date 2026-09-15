export interface Retailer {
  domain: string;
  name: string;
}

export const TRACKING_QUERY_KEYS = new Set([
  "affid",
  "affsrc",
  "ascsubtag",
  "campaign",
  "clickid",
  "cjevent",
  "fbclid",
  "gclid",
  "irclickid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ranMID",
  "ranSiteID",
  "ref",
  "ref_",
  "tag",
  "utm_campaign",
  "utm_content",
  "utm_medium",
  "utm_source",
  "utm_term",
]);

// Includes every store already sold on this site (see lib/data.ts) plus
// the general clothing retailers the scavenger plan called for, so a
// pasted link from any existing offer's store is ingestible on day one.
export const DEFAULT_ALLOWED_RETAILERS: Retailer[] = [
  { domain: "abercrombie.com", name: "Abercrombie & Fitch" },
  { domain: "adidas.com", name: "adidas" },
  { domain: "ae.com", name: "American Eagle" },
  { domain: "amazon.com", name: "Amazon" },
  { domain: "asos.com", name: "ASOS" },
  { domain: "bloomingdales.com", name: "Bloomingdale's" },
  { domain: "champion.com", name: "Champion" },
  { domain: "coachoutlet.com", name: "Coach Outlet" },
  { domain: "dickssportinggoods.com", name: "Dick's Sporting Goods" },
  { domain: "everlane.com", name: "Everlane" },
  { domain: "footlocker.com", name: "Foot Locker" },
  { domain: "gap.com", name: "Gap" },
  { domain: "hm.com", name: "H&M" },
  { domain: "jcrew.com", name: "J.Crew" },
  { domain: "kohls.com", name: "Kohl's" },
  { domain: "levi.com", name: "Levi's" },
  { domain: "lululemon.com", name: "lululemon" },
  { domain: "macys.com", name: "Macy's" },
  { domain: "nordstrom.com", name: "Nordstrom" },
  { domain: "nordstromrack.com", name: "Nordstrom Rack" },
  { domain: "nike.com", name: "Nike" },
  { domain: "oldnavy.gap.com", name: "Old Navy" },
  { domain: "target.com", name: "Target" },
  { domain: "uniqlo.com", name: "UNIQLO" },
  { domain: "urbanoutfitters.com", name: "Urban Outfitters" },
  { domain: "walmart.com", name: "Walmart" },
  { domain: "zara.com", name: "Zara" },
];

export function findRetailer(
  hostname: string,
  allowedRetailers: Retailer[] = DEFAULT_ALLOWED_RETAILERS
): Retailer | undefined {
  const normalizedHost = hostname.toLowerCase().replace(/^www\./, "");
  return allowedRetailers.find((retailer) => {
    const domain = retailer.domain.toLowerCase().replace(/^www\./, "");
    return normalizedHost === domain || normalizedHost.endsWith(`.${domain}`);
  });
}

export function normalizeProductUrl(rawUrl: string): URL {
  const parsed = new URL(rawUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("Only http and https product URLs are supported.");
  }

  parsed.hash = "";
  for (const key of [...parsed.searchParams.keys()]) {
    if (TRACKING_QUERY_KEYS.has(key) || key.startsWith("utm_")) {
      parsed.searchParams.delete(key);
    }
  }

  return parsed;
}
