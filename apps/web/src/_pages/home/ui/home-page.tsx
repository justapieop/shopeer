import Link from "next/link";
import styles from "./home-page.module.css";

export function HomePage() {
  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>shopeer <Link href="/login" className={styles["login"]}>Log in</Link></header>
      <main className={styles["main"]}>
        <h1>Shopping, made simple.</h1>
        <p>A new home for your everyday finds.</p>
      </main>
    </div>
  );
}
