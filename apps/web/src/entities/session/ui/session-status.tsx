"use client";

import Link from "next/link";
import { useSession } from "../model/session-provider";
import styles from "./session-status.module.css";

export function SessionStatus() {
  const { user, status } = useSession();
  if (status === "loading") return <span className={styles["account"]} role="status">Checking session…</span>;
  if (user) return <span className={styles["account"]}>Signed in as {user.username}</span>;
  return <Link href="/login" className={styles["login"]}>Log in</Link>;
}
