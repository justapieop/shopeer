"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { SessionStatus, useSession } from "@/entities/session";
import { fetchCart, type Cart } from "../api/fetch-cart";
import styles from "./cart-page.module.css";

const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
type CartResult = { userId: string; cart?: Cart; error?: string };

export function CartPage() {
  const { user, status, refresh } = useSession();
  const userId = user?.id;
  const [result, setResult] = useState<CartResult | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setResult(null);
    void fetchCart(controller.signal).then(
      (cart) => { if (!controller.signal.aborted) setResult({ userId, cart }); },
      (cause: unknown) => {
        if (!controller.signal.aborted) setResult({ userId, error: cause instanceof Error ? cause.message : "We couldn’t load your cart. Please try again." });
      },
    );
    return () => controller.abort();
  }, [userId, attempt]);

  if (status === "anonymous") redirect("/login?next=cart");
  // Never show data fetched for a previous account, including during revalidation.
  const current = userId && result?.userId === userId ? result : null;
  const cart = current?.cart;
  const sessionFailed = !user && status === "error";

  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>
        <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
        <nav aria-label="Main navigation">
          <Link href="/" prefetch={false}>Home</Link><Link href="/store" prefetch={false}>Store</Link><Link href="/cart" aria-current="page">Cart</Link>
        </nav>
        <SessionStatus />
      </header>
      <main className={styles["main"]}>
        <div className={styles["heading"]}>
          <div><h1>Your cart</h1><p>Review your products and their current prices.</p></div>
          {cart && <Button variant="ghost" className={styles["refresh"] ?? ""} onPress={() => setAttempt((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh cart</Button>}
        </div>
        {sessionFailed || current?.error ? (
          <section className={styles["message"]} aria-label="Cart unavailable">
            <p role="alert">{sessionFailed ? "We couldn’t check your session. Please try again." : current?.error}</p>
            <Button variant="secondary" onPress={() => { if (sessionFailed) void refresh(true); else setAttempt((value) => value + 1); }}>Try again</Button>
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
                    <span className={styles["quantity"]}><span className={styles["mobileLabel"]}>Quantity </span>{item.quantity}</span>
                    <strong className={styles["subtotal"]}>{currency.format(item.subtotal)}</strong>
                  </li>
                ))}
              </ul>
            </section>
            <aside className={styles["summary"]} aria-labelledby="cart-summary">
              <h2 id="cart-summary">Cart summary</h2>
              <dl><div><dt>Items</dt><dd>{cart.totalQuantity}</dd></div><div className={styles["total"]}><dt>Total</dt><dd>{currency.format(cart.totalAmount)}</dd></div></dl>
              <p>Current product prices. Items in your cart aren’t reserved.</p>
              <Link href="/store" prefetch={false} className={styles["shoppingLink"]}><ArrowLeft size={16} aria-hidden="true" /> Continue shopping</Link>
            </aside>
          </div>
        )}
      </main>
      <footer className={styles["footer"]}>Shopping, made simple.</footer>
    </div>
  );
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
