"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@heroui/react";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { SessionStatus, useSession } from "@/entities/session";
import { confirmDelivery, confirmReceipt, fetchOrders, orderBase, OrderViewError, type Order, type OrderMode } from "../api/fetch-orders";
import styles from "./orders-page.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
const statuses = { pending: "Pending", delivered: "Delivered · Awaiting receipt confirmation", completed: "Completed", cancelled: "Cancelled" };
const filters = { pending: "Awaiting delivery", delivered: "Awaiting buyer", completed: "Completed", cancelled: "Cancelled", all: "All orders" };

export function OrdersPage({ mode, orderId }: { mode: OrderMode; orderId?: string }) {
  const { user, status, refresh } = useSession();
  const base = orderBase(mode);
  if (status === "anonymous") redirect(`/login?next=${mode === "buyer" ? "orders" : `${mode}-orders`}${orderId ? `&orderId=${encodeURIComponent(orderId)}` : ""}`);
  return <div className={styles["page"]}>
    <header className={styles["header"]}>
      <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
      <nav aria-label="Main navigation"><Link href="/store" prefetch={false}>Store</Link><Link href="/cart" prefetch={false}>Cart</Link><Link href="/orders" aria-current={mode === "buyer" ? "page" : undefined}>Your orders</Link><Link href="/seller/products">Your products</Link><Link href="/seller/orders" aria-current={mode === "seller" ? "page" : undefined}>Seller orders</Link><Link href="/handler/orders" aria-current={mode === "handler" ? "page" : undefined}>Handler orders</Link></nav>
      <SessionStatus />
    </header>
    <main className={styles["main"]}>
      <div className={styles["heading"]}><h1>{orderId ? "Order details" : mode === "buyer" ? "Your orders" : mode === "handler" ? "Delivery queue" : "Placed orders"}</h1><p>{mode === "buyer" ? "Your purchases, with the prices and status of each order." : mode === "handler" ? "Confirm package delivery. Orders complete when buyers confirm receipt." : "Orders for your products. Amounts include your products only."}</p></div>
      {orderId && <Link className={styles["back"]} href={base}><ArrowLeft size={16} aria-hidden="true" /> {mode === "handler" ? "Back to delivery queue" : `All ${mode === "buyer" ? "your" : "seller"} orders`}</Link>}
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
  const [filter, setFilter] = useState<keyof typeof filters>(mode === "handler" ? "pending" : "all");
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<{ orders?: Order[]; error?: string; denied?: boolean } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    void fetchOrders(mode, page, orderId, controller.signal, filter === "all" ? undefined : filter).then(
      (orders) => { if (!controller.signal.aborted) setResult({ orders }); },
      (cause: unknown) => { if (!controller.signal.aborted) setResult({ error: cause instanceof Error ? cause.message : "We couldn’t load your orders.", denied: cause instanceof OrderViewError && (cause.status === 403 || cause.status === 404) }); },
    );
    return () => controller.abort();
  }, [mode, page, attempt, orderId, filter]);
  const orders = result?.orders ?? [];
  function confirmed(updated: Order) {
    setNotice(`Order ${updated.orderId}: ${updated.status === "completed" ? "receipt confirmed. Order completed." : "delivery confirmed. Waiting for the buyer to confirm receipt."}`);
    setResult(current => current?.orders ? { orders: current.orders.map(item => item.orderId === updated.orderId ? updated : item).filter(item => mode !== "handler" || orderId || filter === "all" || item.status === filter) } : current);
    if (mode === "handler" && !orderId) setAttempt(value => value + 1);
  }
  return <>
    {mode === "handler" && !orderId && <div className={styles["filters"]} role="group" aria-label="Filter orders by status">{(Object.entries(filters) as [keyof typeof filters, string][]).map(([key, label]) => <Button key={key} variant="ghost" aria-pressed={filter === key} onPress={() => { setPage(1); setFilter(key); setNotice(null); }}>{label}</Button>)}</div>}
    {notice && <p className={styles["notice"]} role="status">{notice}</p>}
    {!result ? <p className={styles["message"]} role="status">Loading orders…</p> : result.error ? <section className={styles["message"]}><p role="alert">{result.error}</p>{!result.denied && <Button variant="secondary" onPress={() => setAttempt((value) => value + 1)}>Try again</Button>}<Link href="/store" className={styles["textLink"]}>Back to store</Link></section> : <>
    <div className={styles["toolbar"]}><span>{orders.length ? `${orders.length} ${orders.length === 1 ? "order" : "orders"}${orderId ? "" : ` · Page ${page}`}` : "No orders"}</span><Button variant="ghost" onPress={() => setAttempt((value) => value + 1)}><RefreshCw size={16} aria-hidden="true" /> Refresh orders</Button></div>
    {orders.length ? <div className={styles["orders"]}>{orders.map((order) => <OrderCard key={order.orderId} order={order} mode={mode} detail={Boolean(orderId)} onConfirmed={confirmed} />)}</div>
      : <section className={styles["message"]}><h2>{page > 1 ? "No more orders" : mode === "handler" ? "No orders in this queue" : mode === "buyer" ? "No orders yet" : "No placed orders yet"}</h2><p>{mode === "buyer" ? "Orders you place will appear here." : mode === "handler" ? "Orders matching the selected status will appear here. Refresh to check for new orders." : "Orders containing products sold by you will appear here."}</p>{mode === "buyer" && <Link href="/store" className={styles["textLink"]}>Browse the store</Link>}</section>}
    {!orderId && (page > 1 || orders.length === 20) && <nav className={styles["pagination"]} aria-label="Order pages"><Button variant="secondary" isDisabled={page === 1} onPress={() => setPage((value) => value - 1)}><ArrowLeft size={16} aria-hidden="true" /> Previous</Button><span>Page {page}</span><Button variant="secondary" isDisabled={orders.length < 20} onPress={() => setPage((value) => value + 1)}>Next <ArrowRight size={16} aria-hidden="true" /></Button></nav>}
    </>}
  </>;
}

function OrderCard({ order, mode, detail, onConfirmed }: { order: Order; mode: OrderMode; detail: boolean; onConfirmed: (order: Order) => void }) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);
  async function receive() {
    if (inFlight.current) return;
    inFlight.current = true;
    setConfirming(true);
    setError(null);
    try { onConfirmed(await (mode === "handler" ? confirmDelivery(order.orderId) : confirmReceipt(order.orderId))); }
    catch (cause) { setError(cause instanceof OrderViewError ? cause.message : "We couldn’t confirm this order. Refresh orders to check its status before trying again."); }
    finally { inFlight.current = false; setConfirming(false); }
  }
  const href = `${orderBase(mode)}/${encodeURIComponent(order.orderId)}`;
  return <section className={styles["order"]} aria-label={`Order ${order.orderId}`}>
    <header className={styles["orderHeader"]}><div><h2>{detail ? `Order ${order.orderId}` : <Link href={href} prefetch={false}>Order {order.orderId}</Link>}</h2><p><time dateTime={order.createdAt}>{date.format(new Date(order.createdAt))}</time></p></div><span className={styles["status"]}>{statuses[order.status]}</span></header>
    <ul className={styles["items"]}>{order.items.map((item) => <li key={item.productId}><OrderImage src={item.imageUrl} name={item.name} /><div className={styles["identity"]}><h3>{item.name}</h3><p>{item.quantity} × {money.format(item.unitPrice)}</p></div><span className={styles["amount"]}>{money.format(item.subtotal)}</span></li>)}</ul>
    <div className={styles["total"]}><span>{mode === "seller" ? "Your items total" : "Total"}</span><strong>{money.format(order.totalAmount)}</strong></div>
    {order.status !== "cancelled" && <ol className={styles["progress"]} aria-label="Order completion">
      <li data-done="true">Order placed</li>
      <li data-done={order.status !== "pending"}>{order.status === "pending" ? "Awaiting delivery" : "Delivery confirmed"}</li>
      <li data-done={order.status === "completed"}>{order.status === "completed" ? "Receipt confirmed" : "Awaiting buyer receipt"}</li>
    </ol>}
    {mode === "handler" && order.status === "pending" && <div className={styles["confirmation"]}><p>Confirm only after the package has been delivered. The buyer must still confirm receipt.</p><Button variant="secondary" isPending={confirming} onPress={() => { void receive(); }}>Confirm delivery</Button>{error && <p role="alert">{error}</p>}</div>}
    {order.status === "delivered" && <div className={styles["confirmation"]}>
      <p>{mode === "buyer" ? "The handler confirmed delivery. Confirm receipt only after you have received your package." : "Delivery confirmed. Waiting for the buyer to confirm receipt."}</p>
      {mode === "buyer" && <Button variant="secondary" isPending={confirming} onPress={() => { void receive(); }}>Confirm receipt</Button>}
      {error && <p role="alert">{error}</p>}
    </div>}
  </section>;
}

function OrderImage({ src, name }: { src: string; name: string }) {
  const [failed, setFailed] = useState(false);
  const allowed = /^https?:\/\//i.test(src) || (src.startsWith("/") && !src.startsWith("//"));
  return <div className={styles["image"]}>{allowed && !failed ? <img src={src} alt={name} width={64} height={64} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} /> : <span>No image</span>}</div>;
}
