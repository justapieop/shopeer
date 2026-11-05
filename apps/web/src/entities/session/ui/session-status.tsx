"use client";

import Link from "next/link";
import { Button } from "@heroui/react";
import { useSession } from "../model/session-provider";
import styles from "./session-status.module.css";

export function SessionStatus() {
  const { user, status, refresh } = useSession();
  if (status === "loading") return <span className={styles["account"]} role="status">Checking session…</span>;
  if (user) return <span className={styles["account"]}>Signed in as {user.username}</span>;
  if (status === "error") return <Button variant="ghost" size="sm" onPress={() => { void refresh(true); }}>Retry session check</Button>;
  return <Link href="/login" className={styles["login"]}>Log in</Link>;
}
