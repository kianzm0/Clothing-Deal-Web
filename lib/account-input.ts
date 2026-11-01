import type { Preferences } from "./types";
export class AccountInputError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}
export async function readAccountJson(req: Request, maxBytes = 16384): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) throw new AccountInputError("A JSON body is required.");
  let bytes = 0, text = "";
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) { await reader.cancel(); throw new AccountInputError("Request body is too large.", 413); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } catch (error) {
    if (error instanceof AccountInputError) throw error;
    throw new AccountInputError("A valid JSON body is required.");
  } finally { reader.releaseLock(); }
}
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountInputError("A JSON object is required.");
  return value as Record<string, unknown>;
}
export function parseSignup(value: unknown) {
  const v = object(value);
  if (typeof v.email !== "string" || typeof v.password !== "string") throw new AccountInputError("Email and password are required.");
  const email = v.email.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AccountInputError("A valid email is required.");
  // bcrypt silently truncates after 72 UTF-8 bytes. Reject, never truncate, new passwords.
  if (v.password.length < 8 || new TextEncoder().encode(v.password).byteLength > 72) throw new AccountInputError("Use a password of at least 8 characters and at most 72 UTF-8 bytes.");
  if (v.name !== undefined && (typeof v.name !== "string" || v.name.trim().length > 100)) throw new AccountInputError("Name must be text of at most 100 characters.");
  return { email, password: v.password, name: typeof v.name === "string" ? v.name.trim() || undefined : undefined };
}
export function parseProductId(value: unknown) {
  const { productId } = object(value);
  if (typeof productId !== "string" || !productId.trim() || productId.length > 200) throw new AccountInputError("A productId of 1–200 characters is required.");
  return productId.trim();
}
export function parsePreferences(value: unknown): Preferences {
  const v = object(value);
  function list(key: string) {
    const items = v[key];
    if (!Array.isArray(items) || items.length > 100 || items.some(item => typeof item !== "string" || !item.trim() || item.length > 100)) throw new AccountInputError(`${key} must contain at most 100 nonempty strings of up to 100 characters.`);
    return [...new Set((items as string[]).map(item => item.trim()))];
  }
  function number(key: string, max: number) {
    const n = v[key];
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > max) throw new AccountInputError(`${key} must be a number between 0 and ${max}.`);
    return n;
  }
  // Ignore unknown keys; never forward relation operators or client account IDs.
  return { sizes: list("sizes"), favoriteBrands: list("favoriteBrands"), dislikedBrands: list("dislikedBrands"), colors: list("colors"), fits: list("fits"),
    maxBudget: number("maxBudget", 100000), minDiscountPct: number("minDiscountPct", 100) };
}
