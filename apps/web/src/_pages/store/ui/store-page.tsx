import { Suspense } from "react";
import Link from "next/link";
import { SessionStatus } from "@/entities/session";
import { fetchProducts, fetchCategories } from "../api/catalog.server";
import { parseCatalogQuery, type StoreSearchParams } from "../model/catalog-query";
import { CatalogBrowser } from "./catalog-browser";
import { CatalogError } from "./catalog-error";
import styles from "./store-page.module.css";

export function StorePage({ searchParams }: { searchParams: Promise<StoreSearchParams> }) {
  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>
        <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
        <nav aria-label="Main navigation"><Link href="/" prefetch={false}>Home</Link><Link href="/store" aria-current="page">Store</Link></nav>
        <SessionStatus />
      </header>
      <main className={styles["main"]}>
        <div className={styles["heading"]}><h1>The store</h1><p>Browse everyday finds by category.</p></div>
        <Suspense fallback={<CatalogSkeleton />}><CatalogResults searchParams={searchParams} /></Suspense>
      </main>
      <footer className={styles["footer"]}>Shopping, made simple.</footer>
    </div>
  );
}

async function CatalogResults({ searchParams }: { searchParams: Promise<StoreSearchParams> }) {
  const query = parseCatalogQuery(await searchParams);
  const [products, categories] = await Promise.allSettled([
    fetchProducts(query.page, query.categoryId), fetchCategories(),
  ]);
  if (products.status === "rejected") return <CatalogError missingCategory={products.reason instanceof Error && products.reason.message === "category-not-found"} />;
  return <CatalogBrowser {...query} products={products.value} categories={categories.status === "fulfilled" ? categories.value : []} categoriesUnavailable={categories.status === "rejected"} />;
}

function CatalogSkeleton() {
  return <div className={styles["skeleton"]} role="status" aria-label="Loading products">
    <div className={styles["skeletonNav"]} />
    <ul className={styles["grid"]} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => <li key={index}><div className={styles["skeletonImage"]} /><div className={styles["skeletonLine"]} /><div className={styles["skeletonLine"]} /></li>)}
    </ul>
  </div>;
}
