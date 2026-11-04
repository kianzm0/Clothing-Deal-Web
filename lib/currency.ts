export const SUPPORTED_CURRENCY = "USD" as const;

export function normalizeCurrency(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const currency = value.trim().toUpperCase();
  return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

export function isSupportedCurrency(value: unknown): value is typeof SUPPORTED_CURRENCY {
  return value === SUPPORTED_CURRENCY;
}

export function formatCurrency(amount: number, currency: string | undefined): string {
  if (!isSupportedCurrency(currency)) return "Currency unavailable";
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}
