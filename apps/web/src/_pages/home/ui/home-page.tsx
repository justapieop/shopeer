import Link from "next/link";
import { SessionStatus } from "@/entities/session";
import styles from "./home-page.module.css";

export function HomePage() {
  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>shopeer <SessionStatus /></header>
      <main className={styles["main"]}>
        <h1>Shopping, made simple.</h1>
        <p>A new home for your everyday finds.</p>
        <Link href="/store" className={styles["storeLink"]}>Browse the store <span aria-hidden="true">→</span></Link>
      </main>
    </div>
  );
}
