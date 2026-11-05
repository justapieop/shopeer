import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SessionStatus } from "@/entities/session";
import { fetchServerSession } from "@/entities/session/index.server";
import { fetchProducts, fetchCategories } from "../api/catalog.server";
import { parseCatalogQuery, type StoreSearchParams } from "../model/catalog-query";
import { CatalogBrowser } from "./catalog-browser";
import { CatalogError } from "./catalog-error";
import { StoreSession } from "./store-session";
import styles from "./store-page.module.css";

export async function StorePage({ searchParams }: { searchParams: Promise<StoreSearchParams> }) {
  const session = await fetchServerSession().catch(() => undefined);
  if (session === null) redirect("/login?next=store");
  if (session === undefined) return <CatalogError />;
  return (
    <StoreSession><div className={styles["page"]}>
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
    </div></StoreSession>
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
