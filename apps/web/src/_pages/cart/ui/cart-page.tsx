"use client";

import { useEffect, useMemo, useState, useSyncExternalStore, type FormEvent } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, NumberField } from "@heroui/react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SessionStatus, useSession } from "@/entities/session";
import { fetchCart, type Cart } from "../api/fetch-cart";
import { mutateCart } from "../api/cart-actions";
import { createCartStore, type CartAction } from "../model/cart-store";
import styles from "./cart-page.module.css";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function CartPage() {
  const { user, status, refresh } = useSession();
  const userId = user?.id;
  const store = useMemo(() => createCartStore({ load: fetchCart, mutate: mutateCart }), [userId]);
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  const [drafts, setDrafts] = useState<{ scope: string; ids: string[] }>({ scope: "", ids: [] });
  const draftScope = `${userId ?? ""}:${state.revision}`;
  const hasDrafts = drafts.scope === draftScope && drafts.ids.length > 0;

  useEffect(() => {
    if (!userId) return;
    void store.load();
    return store.cancel;
  }, [userId, store]);

  if (status === "anonymous") redirect("/login?next=cart");
  // Never show data fetched for a previous account, including during revalidation.
  const cart = userId ? state.cart : null;
  const sessionFailed = !user && status === "error";
  const disabled = state.busy || state.loading || state.requiresReview;

  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>
        <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
        <nav aria-label="Main navigation">
          <Link href="/" prefetch={false}>Home</Link><Link href="/store" prefetch={false}>Store</Link><Link href="/cart" aria-current="page">Cart</Link><Link href="/orders" prefetch={false}>Orders</Link>
        </nav>
        <SessionStatus />
      </header>
      <main className={styles["main"]}>
        <div className={styles["heading"]}>
          <div><h1>Your cart</h1><p>Review your products and their current prices.</p></div>
          {cart && <Button variant="ghost" isDisabled={state.busy || state.loading} className={styles["refresh"] ?? ""} onPress={() => { void store.load(); }}><RefreshCw size={16} aria-hidden="true" /> Refresh cart</Button>}
        </div>
        {state.receipt && userId && <section className={styles["receipt"]} role="status">
          <h2>Order placed</h2><p>Order reference: {state.receipt.order.orderId}</p>
          <ul>{state.receipt.order.items.map((item) => <li key={item.productId}>{item.name || state.receipt?.names[item.productId] || "Product"} × {item.quantity} <span>{currency.format(item.subtotal)}</span></li>)}</ul>
          <p>Total: <strong>{currency.format(state.receipt.order.totalAmount)}</strong></p>
          <Link href={`/orders/${encodeURIComponent(state.receipt.order.orderId)}`} prefetch={false}>View this order</Link>
        </section>}
        {userId && state.error && cart && <div className={styles["notice"]} role="alert"><p>{state.error}</p>{state.requiresReview && <Button variant="secondary" isDisabled={state.busy || state.loading} onPress={() => { void store.load(); }}>Refresh cart to review</Button>}</div>}
        {state.busy && <p role="status" className={styles["notice"]}>Updating your cart…</p>}
        {sessionFailed || (!cart && state.error) ? (
          <section className={styles["message"]} aria-label="Cart unavailable">
            <p role="alert">{sessionFailed ? "We couldn’t check your session. Please try again." : state.error}</p>
            <Button variant="secondary" isDisabled={!sessionFailed && (state.busy || state.loading)} onPress={() => { if (sessionFailed) void refresh(true); else void store.load(); }}>Try again</Button>
          </section>
        ) : !cart ? <CartLoading /> : cart.items.length === 0 ? (
          <section className={styles["empty"]}>
            <h2>Your cart is empty</h2>
            <p>Find something you like in the store and add it to your cart.</p>
            <p className={styles["emptyTotal"]}>0 items · {currency.format(cart.totalAmount)}</p>
            <Link href="/store" prefetch={false} className={styles["shoppingLink"]}>Browse the store <span aria-hidden="true">→</span></Link>
          </section>
        ) : (
          <div className={styles["layout"]}>
            <section aria-label="Cart products" className={styles["products"]}>
              <div className={styles["columns"]} aria-hidden="true"><span>Product</span><span>Quantity</span><span>Subtotal</span></div>
              <ul className={styles["list"]}>
                {cart.items.map((item) => (
                  <li key={item.productId} className={styles["item"]}>
                    <CartImage key={item.imageUrl} src={item.imageUrl} name={item.name} />
                    <div className={styles["identity"]}><h2>{item.name}</h2><p>{currency.format(item.unitPrice)} each</p>
                      {item.quantity > item.stock && <p className={styles["stockWarning"]}>{item.stock === 0 ? "Currently out of stock" : `Only ${item.stock} available; you have ${item.quantity} in your cart.`}</p>}
                    </div>
                    <CartQuantity key={`${item.productId}:${state.revision}`} item={item} disabled={disabled} onAction={(action) => { void store.perform(action); }} onDirty={(dirty) => setDrafts((previous) => {
                      const ids = (previous.scope === draftScope ? previous.ids : []).filter((id) => id !== item.productId);
                      return { scope: draftScope, ids: dirty ? [...ids, item.productId] : ids };
                    })} />
                    <strong className={styles["subtotal"]}>{currency.format(item.subtotal)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <aside className={styles["summary"]} aria-labelledby="cart-summary">
              <h2 id="cart-summary">Cart summary</h2>
              <dl><div><dt>Items</dt><dd>{cart.totalQuantity}</dd></div><div className={styles["total"]}><dt>Total</dt><dd>{currency.format(cart.totalAmount)}</dd></div></dl>
              <p>Current product prices. Items in your cart aren’t reserved.</p>
              <Button fullWidth isDisabled={disabled || hasDrafts || cart.items.some((item) => item.quantity > item.stock)} isPending={state.busy} className={styles["checkout"] ?? ""} onPress={() => { void store.perform({ type: "checkout" }); }}>Place order</Button>
              {hasDrafts && <p>Update your quantities before placing your order.</p>}
              {cart.items.some((item) => item.quantity > item.stock) && <p>Reduce unavailable quantities or remove those products before placing your order.</p>}
              <Link href="/store" prefetch={false} className={styles["shoppingLink"]}><ArrowLeft size={16} aria-hidden="true" /> Continue shopping</Link>
            </aside>
          </div>
        )}
      </main>
      <footer className={styles["footer"]}>Shopping, made simple.</footer>
    </div>
  );
}

function CartQuantity({ item, disabled, onAction, onDirty }: { item: Cart["items"][number]; disabled: boolean; onAction: (action: CartAction) => void; onDirty: (dirty: boolean) => void }) {
  const [quantity, setQuantity] = useState(item.quantity);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!disabled && Number.isSafeInteger(quantity) && quantity >= 1 && quantity <= item.stock) onAction({ type: "quantity", productId: item.productId, quantity });
  }
  return <div className={styles["quantity"]}>
    <form onSubmit={submit} aria-label={`Edit quantity for ${item.name}`}>
      <NumberField aria-label={`Quantity for ${item.name}`} minValue={1} maxValue={Math.max(1, item.stock, item.quantity)} step={1} value={quantity} onChange={(value) => { setQuantity(value); onDirty(value !== item.quantity); }} isDisabled={disabled || item.stock === 0}>
        <NumberField.Group className={styles["quantityGroup"] ?? ""}><NumberField.DecrementButton aria-label={`Decrease quantity for ${item.name}`} /><NumberField.Input className={styles["quantityInput"] ?? ""} /><NumberField.IncrementButton aria-label={`Increase quantity for ${item.name}`} /></NumberField.Group>
      </NumberField>
      <Button type="submit" variant="ghost" isDisabled={disabled || quantity === item.quantity || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > item.stock}>Update</Button>
    </form>
    <Button variant="ghost" isDisabled={disabled} onPress={() => onAction({ type: "remove", productId: item.productId })} aria-label={`Remove ${item.name} from cart`}>Remove</Button>
  </div>;
}

function CartImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const allowed = /^https?:\/\//i.test(src) || (src.startsWith("/") && !src.startsWith("//"));
  return <div className={styles["image"]}>
    {!failed && allowed ? <img src={src} alt={name} width={88} height={88} referrerPolicy="no-referrer" loading="lazy" onError={() => setFailed(true)} /> : <span>No image</span>}
  </div>;
}

function CartLoading() {
  return <div role="status" aria-label="Loading your cart" className={styles["loading"]}>
    <p>Loading your cart…</p>
    <div className={styles["loadingRow"]} aria-hidden="true"><span /><span /><span /></div>
    <div className={styles["loadingRow"]} aria-hidden="true"><span /><span /><span /></div>
  </div>;
}
