import { ATTRIBUTION_MS } from "./evaluation";
import type { EvaluationAction, Exposure } from "./evaluation";
const STORAGE_KEY = "threadscout:evaluation-attribution:v1";
type Attribution = { userId: string; productId: string; impressionId: string; at: number };
export async function sendEvaluation(body: unknown) {
  return fetch("/api/evaluation", { method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body), keepalive: true });
}
export function clearAttribution() {
  try { sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage may be blocked. */ }
}
function remember(value: Attribution) {
  try {
    const rows: Attribution[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...rows.filter(r => r.userId === value.userId &&
      r.productId !== value.productId && Date.now() - r.at < ATTRIBUTION_MS).slice(-99), value]));
  } catch { /* Measurement is optional. */ }
}
export function recordAttributedAction(userId: string, productId: string, action: EvaluationAction) {
  try {
    const rows: Attribution[] = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "[]");
    const row = rows.find(r => r.userId === userId && r.productId === productId && Date.now() - r.at >= 0 && Date.now() - r.at <= ATTRIBUTION_MS);
    if (row) void sendEvaluation({ type: "outcome", impressionId: row.impressionId, productId, action }).catch(() => {});
  } catch { /* Never interrupt saves or retailer navigation. */ }
}

/** Kept outside effect setup so StrictMode and ordinary rerenders share dedup state. */
export class ExposureRecorder {
  private pending = new Set<string>();
  private completed = new Set<string>();
  private active = true;
  constructor(private userId: string, private send = sendEvaluation) {}
  stop() { this.active = false; }
  resume() { this.active = true; }
  async record(exposure: Exposure) {
    if (!this.active || this.pending.has(exposure.id) || this.completed.has(exposure.id)) return;
    this.pending.add(exposure.id);
    try {
      // Same event ID on every retry; DB uniqueness protects ambiguous responses.
      for (let attempt = 0; attempt < 3 && this.active; attempt++) {
        try {
          const res = await this.send({ type: "impression", exposure });
          if (res.ok) {
            const data = await res.json();
            this.completed.add(exposure.id);
            if (this.active) remember({ userId: this.userId, productId: exposure.productId, impressionId: data.id, at: Date.now() });
            return;
          }
          if (res.status < 500) return;
        } catch { /* A retry uses the same idempotency key. */ }
      }
    } finally { this.pending.delete(exposure.id); }
  }
}

/** At least 50% of the actual card for 1 uninterrupted second in a visible tab.
 * DOM presence alone is never an impression. Visibility is a proxy, not proof of attention. */
export function observeCards(root: HTMLElement, qualify: (productId: string) => void) {
  if (typeof IntersectionObserver === "undefined") return () => {};
  const visible = new Set<Element>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  function cancel(element: Element) {
    const timer = timers.get(element);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(element);
  }
  function start(element: Element) {
    if (document.visibilityState !== "visible" || timers.has(element)) return;
    timers.set(element, setTimeout(() => {
      timers.delete(element);
      if (document.visibilityState === "visible" && visible.has(element) && element.isConnected && element.hasAttribute("data-recommendation-card")) {
        qualify(element.getAttribute("data-recommendation-card")!);
      }
    }, 1000));
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (entry.isIntersecting && entry.intersectionRatio >= 0.5) { visible.add(entry.target); start(entry.target); }
      else { visible.delete(entry.target); cancel(entry.target); }
    }
  }, { threshold: [0, 0.5] });
  root.querySelectorAll("[data-recommendation-card]").forEach(card => observer.observe(card));
  // Re-observe after tab restoration so stale viewport geometry is not reused.
  const onVisibility = () => {
    for (const element of timers.keys()) cancel(element);
    visible.clear();
    observer.disconnect();
    if (document.visibilityState === "visible") root.querySelectorAll("[data-recommendation-card]").forEach(card => observer.observe(card));
  };
  document.addEventListener("visibilitychange", onVisibility);
  return () => {
    observer.disconnect();
    for (const element of timers.keys()) cancel(element);
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
