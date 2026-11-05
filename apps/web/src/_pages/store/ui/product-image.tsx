"use client";

import { useState } from "react";
import styles from "./store-page.module.css";

export function ProductImage({ src, name, eager }: { src: string; name: string; eager: boolean }) {
  const [failed, setFailed] = useState(false);
  const allowed = /^https?:\/\//i.test(src) || (src.startsWith("/") && !src.startsWith("//"));
  return (
    <div className={styles["image"]}>
      {!failed && allowed ? (
        <img src={src} alt={name} width={400} height={400} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" onError={() => setFailed(true)} />
      ) : <span>Image unavailable</span>}
    </div>
  );
}
