"use client";

import { Button } from "@heroui/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import styles from "./store-page.module.css";

export function CatalogError({ missingCategory = false }: { missingCategory?: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return <section className={styles["empty"]} role="alert">
    <h2>{missingCategory ? "This category isn’t available." : "We couldn’t load the store."}</h2>
    <p>{missingCategory ? "Explore the rest of the catalog instead." : "Please try again in a moment."}</p>
    {missingCategory ? <Link href="/store" className={styles["textLink"]}>Browse all products</Link> : <Button variant="secondary" isPending={pending} onPress={() => startTransition(() => router.refresh())}>{pending ? "Trying again…" : "Try again"}</Button>}
  </section>;
}
