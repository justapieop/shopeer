"use client";

import Link from "next/link";
import { useSession } from "@/entities/session";
import styles from "./home-page.module.css";

export function StoreLink() {
  const { user } = useSession();
  if (!user) return null;
  return <Link href="/store" prefetch={false} className={styles["storeLink"]}>Browse the store <span aria-hidden="true">→</span></Link>;
}
