export const MAX_DEAL_LINK_BODY_BYTES = 64 * 1024;
export const MAX_DEAL_LINKS = 10;
export const MAX_DEAL_LINK_LENGTH = 2048;
export const DEAL_LINK_CONCURRENCY = 3;

export class DealLinksInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

export async function readDealLinks(req: Request): Promise<string[]> {
  const tooLarge = () => new DealLinksInputError("Request body exceeds 64 KiB.", 413);
  // Early rejection is only an optimization: always count streamed bytes too.
  if (Number(req.headers.get("content-length")) > MAX_DEAL_LINK_BODY_BYTES) {
    void req.body?.cancel().catch(() => {});
    throw tooLarge();
  }
  const reader = req.body?.getReader();
  if (!reader) throw new DealLinksInputError("A JSON body is required.");
  let bytes = 0, text = "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let value: unknown;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_DEAL_LINK_BODY_BYTES) throw tooLarge();
      text += decoder.decode(chunk.value, { stream: true });
    }
    value = JSON.parse(text + decoder.decode());
  } catch (error) {
    // Do not let a failing or stalled cancellation replace the useful error.
    void reader.cancel().catch(() => {});
    if (error instanceof DealLinksInputError) throw error;
    throw new DealLinksInputError("A valid UTF-8 JSON body is required.");
  } finally {
    reader.releaseLock();
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new DealLinksInputError("A JSON object with urls is required.");
  }
  const urls = (value as Record<string, unknown>).urls;
  if (!Array.isArray(urls) || urls.length === 0) {
    throw new DealLinksInputError("urls must be a non-empty array.");
  }
  if (urls.length > MAX_DEAL_LINKS) {
    throw new DealLinksInputError(`urls must contain at most ${MAX_DEAL_LINKS} entries.`);
  }
  return urls.map((url: unknown, index) => {
    if (typeof url !== "string" || !url.trim() || url.length > MAX_DEAL_LINK_LENGTH) {
      throw new DealLinksInputError(`urls[${index}] must be a nonempty URL string of at most ${MAX_DEAL_LINK_LENGTH} characters.`);
    }
    try {
      const parsed = new URL(url);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
    } catch {
      throw new DealLinksInputError(`urls[${index}] must be an absolute HTTP(S) URL.`);
    }
    // Preserve the submitted URL in results; security checks remain in scavenger.
    return url;
  });
}

export async function extractDealLinks<T>(
  urls: string[],
  extract: (url: string) => Promise<T>
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(urls.length);
  let next = 0;
  async function worker() {
    while (next < urls.length) {
      const index = next++;
      try {
        results[index] = { status: "fulfilled", value: await extract(urls[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DEAL_LINK_CONCURRENCY, urls.length) }, worker));
  return results;
}
