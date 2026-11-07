"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { SessionStatus, useSession } from "@/entities/session";
import { fetchOrders, OrderViewError, type Order, type OrderMode } from "../api/fetch-orders";
import styles from "./orders-page.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const statuses = { pending: "Pending", completed: "Completed", cancelled: "Cancelled" };

export function OrdersPage({ mode, orderId }: { mode: OrderMode; orderId?: string }) {
  const { user, status, refresh } = useSession();
  const base = mode === "buyer" ? "/orders" : "/seller/orders";
  if (status === "anonymous") redirect(`/login?next=${mode === "buyer" ? "orders" : "seller-orders"}${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`);
  return <div className={styles["page"]}>
    <header className={styles["header"]}>
      <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
      <nav aria-label="Main navigation"><Link href="/store" prefetch={false}>Store</Link><Link href="/cart" prefetch={false}>Cart</Link><Link href="/orders" aria-current={mode === "buyer" ? "page" : undefined}>Your orders</Link><Link href="/seller/orders" aria-current={mode === "seller" ? "page" : undefined}>Seller orders</Link></nav>
      <SessionStatus />
    </header>
    <main className={styles["main"]}>
      <div className={styles["heading"]}><h1>{orderId ? "Order details" : mode === "buyer" ? "Your orders" : "Placed orders"}</h1><p>{mode === "buyer" ? "Your purchases, with the prices and status of each order." : "Orders for your products. Amounts include your products only."}</p></div>
      {orderId && <Link className={styles["back"]} href={base}><ArrowLeft size={16} aria-hidden="true" /> All {mode === "buyer" ? "your" : "seller"} orders</Link>}
      {user ? <OrdersWorkspace key={`${user.id}:${mode}:${orderId ?? "list"}`} mode={mode} orderId={orderId} />
        : status === "error" ? <section className={styles["message"]}><p role="alert">We couldn’t check your session.</p><Button variant="secondary" onPress={() => { void refresh(true); }}>Try again</Button></section>
        : <p role="status">Checking your session…</p>}
    </main>
    <footer className={styles["footer"]}>Shopping, made simple.</footer>
  </div>;
}

function OrdersWorkspace({ mode, orderId }: { mode: OrderMode; orderId: string | undefined }) {
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ orders?: Order[]; error?: string; denied?: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void fetchOrders(mode, page, orderId, controller.signal).then(
      (orders) => { if (!controller.signal.aborted) setResult({ orders }); },
      (cause: unknown) => { if (!controller.signal.aborted) setResult({ error: cause instanceof Error ? cause.message : "We couldn’t load your orders.", denied: cause instanceof OrderViewError && (cause.status === 403 || cause.status === 404) }); },
    );
    return () => controller.abort();
  }, [mode, page, attempt, orderId]);
  if (!result) return <p className={styles["message"]} role="status">Loading orders…</p>;
  if (result.error) return <section className={styles["message"]}><p role="alert">{result.error}</p>{!result.denied && <Button variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</Button>}<Link href="/store" className={styles["textLink"]}>Back to store</Link></section>;
  const orders = result.orders ?? [];
  return <>
    <div className={styles["toolbar"]}><span>{orders.length ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}${orderId ? "" : ` · Page ${page}`}` : "No orders"}</span><Button variant="ghost" onPress={() => setAttempt((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh orders</Button></div>
    {orders.length ? <div className={styles["orders"]}>{orders.map((order) => <OrderCard key={order.orderId} order={order} mode={mode} detail={Boolean(orderId)} />)}</div>
      : <section className={styles["message"]}><h2>{page > 1 ? "No more orders" : mode === "buyer" ? "No orders yet" : "No placed orders yet"}</h2><p>{mode === "buyer" ? "Orders you place will appear here." : "Orders containing products sold by you will appear here."}</p>{mode === "buyer" && <Link href="/store" className={styles["textLink"]}>Browse the store</Link>}</section>}
    {!orderId && (page > 1 || orders.length === 20) && <nav className={styles["pagination"]} aria-label="Order pages"><Button variant="secondary" isDisabled={page === 1} onPress={() => setPage((value) => value - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</Button><span>Page {page}</span><Button variant="secondary" isDisabled={orders.length < 20} onPress={() => setPage((value) => value + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></Button></nav>}
  </>;
}

function OrderCard({ order, mode, detail }: { order: Order; mode: OrderMode; detail: boolean }) {
  const href = `${mode === "buyer" ? "/orders" : "/seller/orders"}/${encodeURIComponent(order.orderId)}`;
  return <section className={styles["order"]} aria-label={`Order ${order.orderId}`}>
    <header className={styles["orderHeader"]}><div><h2>{detail ? `Order ${order.orderId}` : <Link href={href} prefetch={false}>Order {order.orderId}</Link>}</h2><p><time dateTime={order.createdAt}>{date.format(new Date(order.createdAt))}</time></p></div><span className={styles["status"]}>{statuses[order.status]}</span></header>
    <ul className={styles["items"]}>{order.items.map((item) => <li key={item.productId}><OrderImage src={item.imageUrl} name={item.name} /><div className={styles["identity"]}><h3>{item.name}</h3><p>{item.quantity} × {money.format(item.unitPrice)}</p></div><span className={styles["amount"]}>{money.format(item.subtotal)}</span></li>)}</ul>
    <div className={styles["total"]}><span>{mode === "buyer" ? "Total" : "Your items total"}</span><strong>{money.format(order.totalAmount)}</strong></div>
  </section>;
}

function OrderImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const allowed = /^https?:\/\//i.test(src) || (src.startsWith("/") && !src.startsWith("//"));
  return <div className={styles["image"]}>{allowed && !failed ? <img src={src} alt={name} width={64} height={64} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span>No image</span>}</div>;
}
