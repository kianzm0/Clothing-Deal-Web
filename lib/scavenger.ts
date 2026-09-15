import { DEFAULT_ALLOWED_RETAILERS, findRetailer, normalizeProductUrl, Retailer } from "./retailers";

const DEFAULT_TIMEOUT_MS = 12000;

export type Availability = "in_stock" | "out_of_stock" | "preorder" | "unknown";
export type DealStatus = "active" | "needs_review";

export interface DealCandidate {
  sourceUrl: string;
  canonicalUrl: string;
  retailerDomain: string;
  retailerName: string;
  title: string | null;
  brand: string | null;
  imageUrl: string | null;
  priceCents: number | null;
  listPriceCents: number | null;
  currency: string;
  discountPercent: number | null;
  availability: Availability;
  sku: string | null;
  couponCode: string | null;
  fetchedAt: string;
  status: DealStatus;
  confidence: number;
  extractionSources: string[];
  warnings: string[];
}

export interface ScavengeOptions {
  allowedRetailers?: Retailer[];
  timeoutMs?: number;
  userAgent?: string;
}

export class ScavengerError extends Error {
  statusCode: number;
  details: Record<string, unknown>;

  constructor(message: string, statusCode = 400, details: Record<string, unknown> = {}) {
    super(message);
    this.name = "ScavengerError";
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function scavengeProductUrl(
  rawUrl: string,
  options: ScavengeOptions = {}
): Promise<DealCandidate> {
  const allowedRetailers = options.allowedRetailers ?? DEFAULT_ALLOWED_RETAILERS;
  let parsedUrl: URL;

  try {
    parsedUrl = normalizeProductUrl(rawUrl);
  } catch (error) {
    throw new ScavengerError("Invalid product URL.", 400, { cause: (error as Error).message });
  }

  const retailer = findRetailer(parsedUrl.hostname, allowedRetailers);
  if (!retailer) {
    throw new ScavengerError("Retailer is not allowlisted for deal ingestion.", 422, {
      hostname: parsedUrl.hostname,
    });
  }

  const fetchedAt = new Date().toISOString();
  const html = await fetchHtml(parsedUrl.toString(), {
    timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    userAgent: options.userAgent,
  });

  return extractDealCandidate({
    html,
    sourceUrl: rawUrl,
    canonicalUrl: parsedUrl.toString(),
    retailer,
    fetchedAt,
  });
}

export function extractDealCandidate({
  html,
  sourceUrl,
  canonicalUrl,
  retailer,
  fetchedAt,
}: {
  html: string;
  sourceUrl: string;
  canonicalUrl: string;
  retailer: Retailer;
  fetchedAt: string;
}): DealCandidate {
  const jsonLdProducts = extractJsonLdProducts(html);
  const meta = extractMetaTags(html);
  const product = jsonLdProducts[0] ?? {};
  const offer = firstOffer(product.offers);
  const fallbackPrices = extractFallbackPrices(html);

  const price = moneyToCents(
    pickFirst(offer?.price, offer?.lowPrice, product.price, fallbackPrices.price)
  );
  const listPrice = moneyToCents(
    pickFirst(
      offer?.highPrice,
      product.highPrice,
      product.msrp,
      product.listPrice,
      fallbackPrices.listPrice
    )
  );

  const title = cleanText(pickFirst(product.name, meta["og:title"], meta.title));
  const imageUrl = absolutizeUrl(
    pickFirst(firstValue(product.image), meta["og:image"], meta.image),
    canonicalUrl
  );
  const currency = normalizeCurrency(
    pickFirst(offer?.priceCurrency, product.priceCurrency, fallbackPrices.currency, "USD")
  );
  const availability = normalizeAvailability(pickFirst(offer?.availability, product.availability));
  const discountPercent = computeDiscountPercent(price, listPrice);
  const extractionSources = [
    jsonLdProducts.length ? "json_ld_product" : null,
    Object.keys(meta).length ? "meta_tags" : null,
    fallbackPrices.price ? "html_price_fallback" : null,
  ].filter((value): value is string => Boolean(value));

  const confidence = scoreConfidence({ title, price, imageUrl, extractionSources });

  return {
    sourceUrl,
    canonicalUrl,
    retailerDomain: retailer.domain,
    retailerName: retailer.name,
    title,
    brand: cleanText(pickFirst(product.brand?.name, product.brand, meta["product:brand"])),
    imageUrl,
    priceCents: price,
    listPriceCents: listPrice,
    currency,
    discountPercent,
    availability,
    sku: cleanText(pickFirst(product.sku, product.mpn, meta["product:retailer_item_id"])),
    couponCode: null,
    fetchedAt,
    status: confidence >= 0.7 && price ? "active" : "needs_review",
    confidence,
    extractionSources,
    warnings: buildWarnings({ title, price, imageUrl, availability, confidence }),
  };
}

async function fetchHtml(
  url: string,
  { timeoutMs, userAgent }: { timeoutMs: number; userAgent?: string }
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        accept: "text/html,application/xhtml+xml",
        "user-agent":
          userAgent ??
          "ThreadScoutBot/0.1 (+https://github.com/kianzm0/Clothing-Deal-Web; product-price-ingestion)",
      },
    });

    if (!response.ok) {
      throw new ScavengerError("Retailer page could not be fetched.", 502, {
        status: response.status,
        url,
      });
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      throw new ScavengerError("Retailer URL did not return an HTML product page.", 415, {
        contentType,
      });
    }

    return await response.text();
  } catch (error) {
    if (error instanceof ScavengerError) throw error;
    throw new ScavengerError("Timed out or failed while fetching retailer page.", 504, {
      cause: (error as Error).message,
    });
  } finally {
    clearTimeout(timer);
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonLdValue = any;

function extractJsonLdProducts(html: string): JsonLdValue[] {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => decodeHtml(match[1]).trim())
    .filter(Boolean);

  return blocks.flatMap((block) => {
    try {
      return findProductsInJson(JSON.parse(block));
    } catch {
      return [];
    }
  });
}

function findProductsInJson(value: JsonLdValue): JsonLdValue[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(findProductsInJson);
  if (typeof value !== "object") return [];

  const type = value["@type"];
  const types = Array.isArray(type) ? type : [type];
  const direct = types.some((item) => String(item).toLowerCase() === "product") ? [value] : [];
  const graph = value["@graph"] ? findProductsInJson(value["@graph"]) : [];
  return [...direct, ...graph];
}

function extractMetaTags(html: string): Record<string, string> {
  const meta: Record<string, string> = {};
  for (const match of html.matchAll(/<meta\s+([^>]+)>/gi)) {
    const attrs = parseAttributes(match[1]);
    const key = attrs.property ?? attrs.name ?? attrs.itemprop;
    if (key && attrs.content && !meta[key]) {
      meta[key] = decodeHtml(attrs.content);
    }
  }

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) meta.title = decodeHtml(title[1]);

  return meta;
}

function extractFallbackPrices(html: string): { currency?: string; price?: string; listPrice?: string } {
  const currency = pickFirst(
    matchFirst(html, /"priceCurrency"\s*:\s*"([A-Z]{3})"/i),
    matchFirst(html, /itemprop=["']priceCurrency["'][^>]+content=["']([A-Z]{3})["']/i)
  );
  const price = pickFirst(
    matchFirst(html, /"price"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/i),
    matchFirst(html, /itemprop=["']price["'][^>]+content=["'](\d+(?:\.\d{1,2})?)["']/i),
    matchFirst(html, /data-(?:sale-)?price=["']\$?(\d+(?:\.\d{1,2})?)["']/i)
  );
  const listPrice = pickFirst(
    matchFirst(html, /"highPrice"\s*:\s*"?(\d+(?:\.\d{1,2})?)"?/i),
    matchFirst(html, /data-(?:list|original)-price=["']\$?(\d+(?:\.\d{1,2})?)["']/i)
  );

  return { currency, price, listPrice };
}

function firstOffer(offers: JsonLdValue): JsonLdValue {
  if (!offers) return undefined;
  if (Array.isArray(offers)) return offers[0];
  return offers;
}

function firstValue(value: JsonLdValue): JsonLdValue {
  return Array.isArray(value) ? value[0] : value;
}

function pickFirst<T>(...values: (T | null | undefined)[]): T | undefined {
  for (const value of values) {
    if (value !== undefined && value !== null && (value as unknown) !== "") return value;
  }
  return undefined;
}

function moneyToCents(value: unknown): number | null {
  if (value === undefined || value === null || value === "") return null;
  const normalized = String(value).replace(/[^0-9.]/g, "");
  if (!normalized) return null;
  return Math.round(Number.parseFloat(normalized) * 100);
}

function computeDiscountPercent(priceCents: number | null, listPriceCents: number | null): number | null {
  if (!priceCents || !listPriceCents || listPriceCents <= priceCents) return null;
  return Math.round(((listPriceCents - priceCents) / listPriceCents) * 100);
}

function normalizeCurrency(value: unknown): string {
  const currency = String(value ?? "USD").toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : "USD";
}

function normalizeAvailability(value: unknown): Availability {
  if (!value) return "unknown";
  const raw = String(value).toLowerCase();
  if (raw.includes("instock") || raw.includes("in stock")) return "in_stock";
  if (raw.includes("outofstock") || raw.includes("out of stock")) return "out_of_stock";
  if (raw.includes("preorder")) return "preorder";
  if (raw.includes("soldout") || raw.includes("sold out")) return "out_of_stock";
  return "unknown";
}

function cleanText(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "object") return cleanText((value as { name?: unknown }).name);
  return decodeHtml(String(value)).replace(/\s+/g, " ").trim() || null;
}

function absolutizeUrl(value: unknown, baseUrl: string): string | null {
  if (!value) return null;
  try {
    return new URL(String(value), baseUrl).toString();
  } catch {
    return null;
  }
}

function scoreConfidence({
  title,
  price,
  imageUrl,
  extractionSources,
}: {
  title: string | null;
  price: number | null;
  imageUrl: string | null;
  extractionSources: string[];
}): number {
  let score = 0;
  if (title) score += 0.25;
  if (price) score += 0.35;
  if (imageUrl) score += 0.15;
  if (extractionSources.includes("json_ld_product")) score += 0.2;
  if (extractionSources.includes("meta_tags")) score += 0.05;
  return Number(Math.min(score, 1).toFixed(2));
}

function buildWarnings({
  title,
  price,
  imageUrl,
  availability,
  confidence,
}: {
  title: string | null;
  price: number | null;
  imageUrl: string | null;
  availability: Availability;
  confidence: number;
}): string[] {
  return [
    title ? null : "Missing product title.",
    price ? null : "Missing current price.",
    imageUrl ? null : "Missing product image.",
    availability === "out_of_stock" ? "Product appears out of stock." : null,
    confidence < 0.7 ? "Low extraction confidence; send to editorial review before publishing." : null,
  ].filter((value): value is string => Boolean(value));
}

function parseAttributes(rawAttributes: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  for (const match of rawAttributes.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attrs[match[1].toLowerCase()] = match[3];
  }
  return attrs;
}

function matchFirst(value: string, regex: RegExp): string | undefined {
  return value.match(regex)?.[1];
}

function decodeHtml(value: unknown): string {
  return String(value)
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&#x22;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'");
}
