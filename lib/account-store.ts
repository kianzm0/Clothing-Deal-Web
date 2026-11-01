/** One store per resource/account; never persist authenticated data in browser storage. */
export class AccountStore<T> {
  private listeners = new Set<() => void>();
  private generation = 0;
  private controller?: AbortController;
  private confirmed: T;
  private pending: Array<(value: T) => T> = [];
  private running = false;
  private snapshot: { data: T; hydrated: boolean; error: string | null };
  readonly initial: { data: T; hydrated: boolean; error: string | null };
  constructor(private fallback: T, private load: (signal: AbortSignal) => Promise<T>,
    private save: (next: T, previous: T, signal: AbortSignal) => Promise<void>) {
    this.confirmed = fallback;
    this.initial = this.snapshot = { data: fallback, hydrated: false, error: null };
  }
  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.initial;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    if (this.listeners.size === 1) this.reload();
    return () => {
      this.listeners.delete(listener);
      if (!this.listeners.size) {
        this.generation++; this.controller?.abort(); this.pending = []; this.running = false;
        this.confirmed = this.fallback; this.snapshot = this.initial;
      }
    };
  };
  private publish(hydrated: boolean, error: string | null) {
    this.snapshot = { data: this.pending.reduce((data, update) => update(data), this.confirmed), hydrated, error };
    this.listeners.forEach(listener => listener());
  }
  reload = () => {
    if (!this.listeners.size) return;
    const generation = ++this.generation;
    this.controller?.abort(); this.controller = new AbortController();
    this.pending = []; this.running = false; this.confirmed = this.fallback;
    this.publish(false, null);
    this.load(this.controller.signal).then(data => {
      if (generation !== this.generation) return;
      this.confirmed = data; this.publish(true, null);
    }).catch(() => {
      if (generation === this.generation) this.publish(false, "Could not load your saved data. Please retry.");
    });
  };
  update = (change: (value: T) => T) => {
    if (!this.listeners.size || !this.snapshot.hydrated) return;
    this.pending.push(change); this.publish(true, null);
    void this.flush();
  };
  private async flush() {
    if (this.running) return;
    this.running = true;
    const generation = this.generation, signal = this.controller!.signal;
    while (this.pending.length && generation === this.generation) {
      const next = this.pending[0](this.confirmed);
      try {
        await this.save(next, this.confirmed, signal);
        if (generation !== this.generation) return;
        this.confirmed = next; this.pending.shift(); this.publish(true, this.snapshot.error);
      } catch {
        if (generation !== this.generation) return;
        // Roll back the failed intent and rebase queued edits on confirmed state.
        this.pending.shift(); this.publish(true, "Could not save that change. Please try again.");
      }
    }
    if (generation === this.generation) this.running = false;
  }
}
