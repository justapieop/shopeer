"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button, Input, Label, TextField } from "@heroui/react";
import { SessionStatus, useSession } from "@/entities/session";
import { fetchCategories, fetchProducts, postPeriod, postProduct, SalesError, type SellerProduct } from "../api/sales";
import styles from "./seller-products-page.module.css";

const money = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });
const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" });
type Categories = Awaited<ReturnType<typeof fetchCategories>>;

export function SellerProductsPage() {
  const { user, status, refresh } = useSession();
  if (status === "anonymous") redirect("/login?next=seller-products");
  return <div className={styles["page"]}>
    <header className={styles["header"]}><Link href="/" className={styles["wordmark"]}>shopeer</Link><nav aria-label="Main navigation"><Link href="/store">Store</Link><Link href="/seller/products" aria-current="page">Your products</Link><Link href="/seller/orders">Seller orders</Link><Link href="/orders">Your orders</Link></nav><SessionStatus /></header>
    <main className={styles["main"]}><h1>Your products</h1><p className={styles["intro"]}>Post a product with a fixed quantity. Offer leftovers and additional stock in its next sales period.</p>
      {user ? <Workspace key={user.id} /> : status === "error" ? <><p role="alert">We couldn’t check your session.</p><Button onPress={() => { void refresh(true); }}>Try again</Button></> : <p role="status">Checking your session…</p>}
    </main>
  </div>;
}

function Workspace() {
  const [page, setPage] = useState(1);
  const [products, setProducts] = useState<SellerProduct[] | null>(null);
  const [categories, setCategories] = useState<Categories>([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [denied, setDenied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [creating, setCreating] = useState(false);
  const [now, setNow] = useState(Date.now());
  const gate = useRef(false);
  const alive = useRef(true);
  const read = useRef<AbortController | null>(null);

  async function load(targetPage = page) {
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    setBusy(true); setError("");
    try {
      const [items, choices] = await Promise.all([fetchProducts(targetPage, controller.signal), fetchCategories(controller.signal)]);
      if (!alive.current || controller.signal.aborted) return;
      setProducts(items); setCategories(choices); setDenied(false); setUncertain(false); setNow(Date.now());
    } catch (cause) {
      if (!alive.current || controller.signal.aborted) return;
      setError(cause instanceof SalesError ? cause.message : "We couldn’t refresh your products. Please try again.");
      if (cause instanceof SalesError && (cause.status === 401 || cause.status === 403)) { setDenied(true); setProducts(null); }
    } finally { if (alive.current && !controller.signal.aborted) setBusy(false); }
  }

  useEffect(() => {
    alive.current = true;
    void load(page);
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive.current = false; read.current?.abort(); clearInterval(timer); };
    // Page changes create a fresh read; mutation responses never change the account scope.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function submit(event: FormEvent<HTMLFormElement>, product?: SellerProduct) {
    event.preventDefault();
    if (gate.current || busy || uncertain || denied) return;
    gate.current = true; setBusy(true); setError(""); setNotice("");
    const form = event.currentTarget;
    const data = new FormData(form);
    try {
      const endsAt = new Date(String(data.get("endsAt")));
      if (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now()) throw new SalesError("Choose an end date in the future.", 400);
      const result = product ? await postPeriod(product.productId, { additionalStock: Number(data.get("additionalStock")), endsAt: endsAt.toISOString() })
        : await postProduct({ name: String(data.get("name")).trim(), description: String(data.get("description")).trim(), categoryId: String(data.get("categoryId")), imageUrl: String(data.get("imageUrl")), price: Number(data.get("price")), stock: Number(data.get("stock")), endsAt: endsAt.toISOString() });
      if (!alive.current) return;
      setNotice(`Published ${result.quantity} units. This quantity is now locked.`);
      form.reset(); setCreating(false);
      // A confirmed publication is retained even if the following read fails.
      setUncertain(true);
      await load();
    } catch (cause) {
      if (!alive.current) return;
      const unknown = !(cause instanceof SalesError) || cause.status >= 500;
      setUncertain(unknown || (cause instanceof SalesError && cause.status === 409));
      setError(cause instanceof SalesError ? cause.message : "We couldn’t confirm publication. Refresh and review your products before posting again.");
      if (cause instanceof SalesError && (cause.status === 401 || cause.status === 403)) { setDenied(true); setProducts(null); }
    } finally { gate.current = false; if (alive.current) setBusy(false); }
  }

  const disabled = busy || uncertain || denied;
  return <>
    <div className={styles["toolbar"]}><Button isDisabled={disabled || !products} onPress={() => setCreating(!creating)}>{creating ? "Close form" : "Post a product"}</Button><Button variant="secondary" isDisabled={busy} onPress={() => { void load(); }}>Refresh products</Button></div>
    {notice && <p role="status" className={styles["notice"]}>{notice}</p>}
    {error && <p role="alert" className={styles["notice"]}>{error}</p>}
    {creating && !denied && <section className={styles["composer"]}><h2>Post a product</h2><p>Sales start immediately. Quantity and product details are locked when you publish.</p><form onSubmit={(event) => { void submit(event); }}><fieldset disabled={disabled} className={styles["fields"]}>
      <Field name="name" label="Product name" maxLength={200} />
      <Field name="description" label="Description" maxLength={4000} />
      <label className={styles["select"]}>Category<select name="categoryId" required defaultValue=""><option value="" disabled>Choose a category</option>{categories.map((category) => <option key={category.categoryId} value={category.categoryId}>{category.name}</option>)}</select></label>
      <Field name="imageUrl" label="Image URL" type="url" maxLength={2000} />
      <Field name="price" label="Price (VND)" type="number" min={1} max={2147483647} />
      <Field name="stock" label="Quantity" type="number" min={1} max={2147483647} />
      <Field name="endsAt" label="Sales end (your local time)" type="datetime-local" />
      <div className={styles["submit"]}><Button type="submit" isDisabled={disabled || !categories.length}>Publish product</Button></div>
    </fieldset></form></section>}
    {!products && !error && <p role="status">Loading your products…</p>}
    {products?.length === 0 && <section className={styles["empty"]}><h2>{page === 1 ? "No products yet" : "No more products"}</h2><p>Products you post will appear here with their sales periods.</p></section>}
    {products?.map((product) => {
      const current = product.periods[0];
      const active = current && new Date(current.endsAt).getTime() > now && product.stock > 0;
      return <section key={product.productId} className={styles["product"]}>
        <div className={styles["productHeading"]}><div><h2>{product.name}</h2><p>{money.format(product.price)}</p></div><span>{active ? "On sale" : current ? product.stock === 0 ? "Sold out" : "Period ended" : "Ready to publish"}</span></div>
        <dl className={styles["quantities"]}><div><dt>{active ? "Available" : "Leftover stock"}</dt><dd>{product.stock.toLocaleString()}</dd></div>{current && <div><dt>Published quantity</dt><dd>{current.quantity.toLocaleString()}</dd></div>}</dl>
        {active ? <p className={styles["muted"]}>Quantity locked until <time dateTime={current.endsAt}>{date.format(new Date(current.endsAt))}</time>. Additional stock can go in the next period.</p>
          : <form onSubmit={(event) => { void submit(event, product); }}><fieldset disabled={disabled} className={styles["periodForm"]}><Field name="additionalStock" label="Additional stock" type="number" min={0} max={2147483647} defaultValue="0" /><Field name="endsAt" label="Sales end (your local time)" type="datetime-local" /><Button type="submit" isDisabled={disabled}>Publish next period</Button></fieldset><p className={styles["muted"]}>New quantity = {product.stock.toLocaleString()} leftover units + additional stock.</p></form>}
        {current && <details className={styles["history"]}><summary>Sales history · latest {product.periods.length} {product.periods.length === 1 ? "period" : "periods"}</summary><div className={styles["tableScroll"]}><table><thead><tr><th>Period</th><th>Published</th><th>Sold</th><th>Left over</th></tr></thead><tbody>{product.periods.map((period) => <tr key={period.id}><td>{date.format(new Date(period.startsAt))}<br />to {date.format(new Date(period.endsAt))}</td><td>{period.quantity.toLocaleString()}</td><td>{(period.quantity - period.remaining).toLocaleString()}</td><td>{period.remaining.toLocaleString()}</td></tr>)}</tbody></table></div></details>}
      </section>;
    })}
    {products && (page > 1 || products.length === 20) && <nav className={styles["pagination"]} aria-label="Product pages"><Button variant="secondary" isDisabled={busy || page === 1} onPress={() => { setProducts(null); setPage(page - 1); }}>Previous</Button><span>Page {page}</span><Button variant="secondary" isDisabled={busy || products.length < 20} onPress={() => { setProducts(null); setPage(page + 1); }}>Next</Button></nav>}
  </>;
}

function Field({ name, label, type = "text", min, max, maxLength, defaultValue }: { name: string; label: string; type?: "text" | "number" | "url" | "datetime-local"; min?: number; max?: number; maxLength?: number; defaultValue?: string }) {
  return <TextField name={name} type={type} isRequired {...(defaultValue === undefined ? {} : { defaultValue })} className={styles["field"] ?? ""}><Label>{label}</Label><Input min={min} max={max} maxLength={maxLength} step={type === "number" ? 1 : undefined} /></TextField>;
}
