import styles from "./home-page.module.css";

export function HomePage() {
  return (
    <main className={styles["page"]}>
      <p className={styles["eyebrow"]}>Shopeer</p>
      <h1>Your storefront starts here.</h1>
      <p>A new home for products, carts, and orders.</p>
    </main>
  );
}
