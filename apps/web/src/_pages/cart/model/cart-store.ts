import type { components } from "@shopeer/web-lib";

export type Cart = components["schemas"]["CartResponseDto"];
export type Order = components["schemas"]["OrderResponseDto"];
export type CartAction = { type: "quantity"; productId: string; quantity: number } | { type: "remove"; productId: string } | { type: "checkout" };
export class CartActionError extends Error {
  readonly status: number | undefined;
  constructor(message: string, status?: number) { super(message); this.status = status; }
}
type Snapshot = {
  cart: Cart | null; revision: number; loading: boolean; busy: boolean; error: string | null; requiresReview: boolean;
  receipt: { order: Order; names: Record<string, string> } | null;
};
type CartApi = {
  load: (signal: AbortSignal) => Promise<Cart>;
  mutate: (action: CartAction) => Promise<{ cart: Cart } | { order: Order }>;
};

/** One operation at a time; writes are never replayed after conflicts or outages. */
export function createCartStore(api: CartApi) {
  let snapshot: Snapshot = { cart: null, revision: 0, loading: true, busy: false, error: null, requiresReview: false, receipt: null };
  const initial = snapshot;
  const listeners = new Set<() => void>();
  let generation = 0;
  let controller: AbortController | null = null;
  const publish = (patch: Partial<Snapshot>) => {
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };
  function cancel() { generation++; controller?.abort(); }
  async function read(): Promise<boolean> {
    cancel();
    const version = generation;
    const request = new AbortController();
    controller = request;
    publish({ loading: true });
    try {
      const cart = await api.load(request.signal);
      if (generation !== version) return false;
      publish({ cart, revision: snapshot.revision + 1, loading: false });
      return true;
    } catch (cause) {
      if (generation !== version) return false;
      publish({ loading: false, requiresReview: true, error: cause instanceof Error ? cause.message : "We couldn’t refresh your cart. Please try again." });
      return false;
    }
  }
  async function load() {
    if (snapshot.busy) return;
    publish({ error: null });
    if (await read()) publish({ requiresReview: false });
  }
  async function perform(action: CartAction) {
    if (snapshot.busy || snapshot.loading || snapshot.requiresReview || !snapshot.cart) return;
    if (action.type === "quantity" && (!Number.isSafeInteger(action.quantity) || action.quantity < 1)) {
      publish({ error: "Choose a valid whole-number quantity." });
      return;
    }
    if (action.type === "checkout" && (!snapshot.cart.items.length || snapshot.cart.items.some((item) => item.quantity > item.stock))) return;
    const names = Object.fromEntries(snapshot.cart.items.map((item) => [item.productId, item.name]));
    cancel();
    publish({ busy: true, error: null, receipt: action.type === "checkout" ? null : snapshot.receipt });
    try {
      const result = await api.mutate(action);
      if ("cart" in result) publish({ cart: result.cart, revision: snapshot.revision + 1, receipt: null });
      else {
        publish({ receipt: { order: result.order, names }, requiresReview: true });
        if (await read()) publish({ requiresReview: false });
      }
    } catch (cause) {
      const error = cause instanceof Error ? cause.message : "We couldn’t confirm the change. Refresh your cart before trying again.";
      const status = cause instanceof CartActionError ? cause.status : undefined;
      publish({ error, requiresReview: true });
      // Refresh only reads after a definitive conflict; keep the message visible
      // so the buyer reviews new contents before making another explicit choice.
      if (status === 409 || status === 404) {
        if (await read()) publish({ requiresReview: false });
      } else if (status !== undefined && status < 500) publish({ requiresReview: false });
    } finally { publish({ busy: false }); }
  }
  return {
    getSnapshot: () => snapshot, getServerSnapshot: () => initial,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    load, perform, cancel,
  };
}
