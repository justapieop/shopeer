"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { components } from "@shopeer/web-lib";
import { catalogHref, PAGE_SIZE } from "../model/catalog-query";
import { ProductImage } from "./product-image";
import { AddToCart } from "./add-to-cart";
import { addCartItem, type Cart } from "../api/add-cart-item";
import { createCartQueue } from "../model/cart-queue";
import styles from "./store-page.module.css";

type Product = components["schemas"]["ProductResponseDto"];
type Category = components["schemas"]["CategoryResponseDto"];
const currency = new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 });

export function CatalogBrowser({ products, categories, page, categoryId, categoriesUnavailable }: {
  products: Product[]; categories: Category[]; page: number; categoryId: string; categoriesUnavailable: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cart, setCart] = useState<Cart | null>(null);
  const [queueAddition] = useState(() => createCartQueue(addCartItem));
  const catalog = useRef<HTMLDivElement>(null);
  const previousQuery = useRef({ page, categoryId });
  const hasNext = products.length === PAGE_SIZE;
  const first = (page - 1) * PAGE_SIZE + 1;
  const categoryNames = new Map(categories.map((category) => [category.categoryId, category.name]));

  async function addToCart(productId: string, quantity: number) {
    const updated = await queueAddition(productId, quantity);
    setCart(updated);
    return updated;
  }

  useEffect(() => {
    if (previousQuery.current.page !== page || previousQuery.current.categoryId !== categoryId) {
      if (catalog.current && catalog.current.getBoundingClientRect().top < 0) catalog.current.scrollIntoView({ block: "start" });
      previousQuery.current = { page, categoryId };
    }
  }, [page, categoryId]);

  function navigation(href: string, label: ReactNode, className: string, active = false) {
    return (
      <Link href={href} prefetch={false} scroll={false} className={className}
        aria-current={active ? "page" : undefined} aria-disabled={pending || undefined}
        onMouseEnter={() => { if (!pending && !active) router.prefetch(href); }}
        onFocus={() => { if (!pending && !active) router.prefetch(href); }}
        onNavigate={(event) => {
          event.preventDefault();
          if (!pending && !active) startTransition(() => router.push(href, { scroll: false }));
        }}>
        {label}
      </Link>
    );
  }

  return (
    <div ref={catalog} className={styles["catalog"]} aria-busy={pending}>
      <nav className={styles["categories"]} aria-label="Product categories">
        {navigation("/store", "All products", styles["category"] ?? "", !categoryId)}
        {categories.map((category) => (
          <span key={category.categoryId}>
            {navigation(catalogHref({ page: 1, categoryId: category.categoryId }), category.name, styles["category"] ?? "", categoryId === category.categoryId)}
          </span>
        ))}
      </nav>
      {categoriesUnavailable && <p className={styles["notice"]}>Categories are temporarily unavailable. You can still browse the products.</p>}
      <div className={styles["summary"]}>
        <p>{products.length ? `Products ${first}–${first + products.length - 1}` : "No products to show"} <span>· Page {page}</span></p>
        <span role="status" aria-live="polite">{pending ? "Loading products…" : "Sorted by name"}</span>
      </div>
      {cart && <p className={styles["cartSummary"]} role="status" aria-live="polite">Cart: {cart.totalQuantity} {cart.totalQuantity === 1 ? "item" : "items"} · {currency.format(cart.totalAmount)} · <Link href="/cart" prefetch={false} className={styles["textLink"]}>View cart</Link></p>}
      {products.length ? (
        <ul className={styles["grid"]} data-pending={pending || undefined}>
          {products.map((product, index) => {
            const cartItem = cart?.items.find((item) => item.productId === product.productId);
            const stock = cartItem?.stock ?? product.stock;
            const available = Math.max(0, stock - (cartItem?.quantity ?? 0));
            return (
            <li key={product.productId} className={styles["product"]}>
              <ProductImage key={product.imageUrl} src={product.imageUrl} name={product.name} eager={index < 3} />
              <div className={styles["productMeta"]}>
                <span>{categoryNames.get(product.categoryId) ?? "Product"}</span>
                <span>{stock > 0 ? "In stock" : "Sold out"}</span>
              </div>
              <h2>{product.name}</h2>
              <p className={styles["description"]}>{product.description}</p>
              <p className={styles["price"]}>{currency.format(cartItem?.unitPrice ?? product.price)}</p>
              <AddToCart productId={product.productId} name={product.name} stock={stock} available={available} onAdd={addToCart} />
            </li>
          ); })}
        </ul>
      ) : (
        <div className={styles["empty"]}>
          <h2>{page > 1 ? "You’ve reached the end." : "Nothing here just yet."}</h2>
          <p>{page > 1 ? "Go back a page to keep browsing." : "Try another category or come back soon for new finds."}</p>
          {categoryId && navigation("/store", "Browse all products", styles["textLink"] ?? "")}
        </div>
      )}
      <nav className={styles["pagination"]} aria-label="Catalog pages">
        {page > 1 ? navigation(catalogHref({ page: page - 1, categoryId }), <><ArrowLeft size={16} aria-hidden="true" /> Previous</>, styles["pageLink"] ?? "") : <span className={styles["disabled"]} aria-disabled="true"><ArrowLeft size={16} aria-hidden="true" /> Previous</span>}
        <span aria-current="page">Page {page}</span>
        {hasNext ? navigation(catalogHref({ page: page + 1, categoryId }), <>Next <ArrowRight size={16} aria-hidden="true" /></>, styles["pageLink"] ?? "") : <span className={styles["disabled"]} aria-disabled="true">Next <ArrowRight size={16} aria-hidden="true" /></span>}
      </nav>
    </div>
  );
}
