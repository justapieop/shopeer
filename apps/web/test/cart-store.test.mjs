import assert from "node:assert/strict";
import { test } from "node:test";
import { CartActionError, createCartStore } from "../src/_pages/cart/model/cart-store.ts";

const cart = { cartId: "cart", items: [{ productId: "mug", name: "Coffee mug", quantity: 1, stock: 10, unitPrice: 100, subtotal: 100 }], totalQuantity: 1, totalAmount: 100 };
const empty = { ...cart, items: [], totalQuantity: 0, totalAmount: 0 };
const deferred = () => { let resolve; const promise = new Promise((done) => { resolve = done; }); return { promise, resolve }; };

test("serializes writes and ignores double checkout while the first request is pending", async () => {
  const gate = deferred();
  let writes = 0, reads = 0;
  const store = createCartStore({ load: async () => ++reads === 1 ? cart : empty, mutate: async () => { writes++; return gate.promise; } });
  await store.load();
  const purchase = store.perform({ type: "checkout" });
  await store.perform({ type: "checkout" });
  await store.perform({ type: "quantity", productId: "mug", quantity: 2 });
  await store.load();
  assert.equal(writes, 1);
  assert.equal(store.getSnapshot().busy, true);
  gate.resolve({ order: { orderId: "order", items: cart.items, totalAmount: 100 } });
  await purchase;
  assert.equal(store.getSnapshot().receipt.order.orderId, "order");
  assert.equal(store.getSnapshot().receipt.names.mug, "Coffee mug");
  assert.equal(store.getSnapshot().cart.totalQuantity, 0);
  assert.equal(store.getSnapshot().busy, false);
});

for (const status of [404, 409]) {
  test(`refreshes after ${status} without retrying the mutation`, async () => {
    let writes = 0, reads = 0;
    const store = createCartStore({ load: async () => ++reads === 1 ? cart : empty, mutate: async () => { writes++; throw new CartActionError("Review the latest cart", status); } });
    await store.load();
    await store.perform({ type: "quantity", productId: "mug", quantity: 2 });
    assert.equal(writes, 1);
    assert.equal(reads, 2);
    assert.equal(store.getSnapshot().cart.items.length, 0);
    assert.match(store.getSnapshot().error, /Review/);
    assert.equal(store.getSnapshot().requiresReview, false);
  });
}

for (const status of [undefined, 503]) {
  test(`requires explicit review after an uncertain ${status ?? "network"} response`, async () => {
    let writes = 0;
    const store = createCartStore({ load: async () => cart, mutate: async () => { writes++; throw new CartActionError("Could not confirm checkout", status); } });
    await store.load();
    await store.perform({ type: "checkout" });
    await store.perform({ type: "checkout" });
    assert.equal(writes, 1);
    assert.equal(store.getSnapshot().requiresReview, true);
    await store.load();
    assert.equal(store.getSnapshot().requiresReview, false);
  });
}

test("a failed conflict refresh blocks more writes until a successful explicit read", async () => {
  let reads = 0, writes = 0;
  const store = createCartStore({ load: async () => { if (++reads === 2) throw new Error("Offline"); return cart; }, mutate: async () => { writes++; throw new CartActionError("Conflict", 409); } });
  await store.load();
  await store.perform({ type: "remove", productId: "mug" });
  await store.perform({ type: "checkout" });
  assert.equal(writes, 1);
  assert.equal(store.getSnapshot().requiresReview, true);
  await store.load();
  assert.equal(store.getSnapshot().requiresReview, false);
});

test("late reads cannot replace newer cart results", async () => {
  const gate = deferred();
  let reads = 0;
  const store = createCartStore({ load: async () => ++reads === 1 ? gate.promise : empty, mutate: async () => ({ cart }) });
  const old = store.load();
  await store.load();
  gate.resolve(cart);
  await old;
  assert.equal(store.getSnapshot().cart, empty);
});

test("retains order confirmation if reloading the cart fails after successful checkout", async () => {
  let reads = 0, writes = 0;
  const store = createCartStore({ load: async () => { if (++reads > 1) throw new Error("Offline"); return cart; }, mutate: async () => { writes++; return { order: { orderId: "placed", items: cart.items, totalAmount: 100 } }; } });
  await store.load();
  await store.perform({ type: "checkout" });
  assert.equal(store.getSnapshot().receipt.order.orderId, "placed");
  assert.equal(store.getSnapshot().requiresReview, true);
  await store.perform({ type: "checkout" });
  assert.equal(writes, 1);
});

test("an earlier receipt cannot look like confirmation of a later uncertain checkout", async () => {
  let writes = 0;
  const store = createCartStore({ load: async () => cart, mutate: async () => {
    if (++writes === 1) return { order: { orderId: "first", items: cart.items, totalAmount: 100 } };
    throw new CartActionError("Unconfirmed response");
  } });
  await store.load();
  await store.perform({ type: "checkout" });
  assert.equal(store.getSnapshot().receipt.order.orderId, "first");
  await store.perform({ type: "checkout" });
  assert.equal(store.getSnapshot().receipt, null);
  assert.equal(store.getSnapshot().requiresReview, true);
});

test("empty carts and unavailable quantities cannot check out", async () => {
  for (const value of [empty, { ...cart, items: [{ ...cart.items[0], stock: 0 }] }]) {
    let writes = 0;
    const store = createCartStore({ load: async () => value, mutate: async () => { writes++; return { cart }; } });
    await store.load();
    await store.perform({ type: "checkout" });
    assert.equal(writes, 0);
  }
});

test("successful quantity edits replace totals with the server response", async () => {
  const updated = { ...cart, totalQuantity: 2, totalAmount: 250 };
  const store = createCartStore({ load: async () => cart, mutate: async () => ({ cart: updated }) });
  await store.load();
  await store.perform({ type: "quantity", productId: "mug", quantity: 2 });
  assert.equal(store.getSnapshot().cart, updated);
  assert.equal(store.getSnapshot().revision, 2);
});
