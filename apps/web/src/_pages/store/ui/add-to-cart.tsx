"use client";

import { Button, Label, NumberField } from "@heroui/react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useSession } from "@/entities/session";
import type { Cart } from "../api/add-cart-item";
import styles from "./store-page.module.css";

export function AddToCart({ productId, name, available, stock, onAdd }: {
  productId: string; name: string; available: number; stock: number;
  onAdd: (productId: string, quantity: number) => Promise<Cart>;
}) {
  const { user } = useSession();
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const submitting = useRef(false);
  const maximum = Math.max(1, available);

  useEffect(() => { setQuantity((current) => Math.min(current, maximum)); }, [maximum]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || !user || available < 1) return;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > available) {
      setError(`Choose a whole number from 1 to ${available}.`);
      return;
    }
    submitting.current = true;
    setPending(true);
    setError("");
    setMessage("");
    try {
      await onAdd(productId, quantity);
      setMessage(`Added ${quantity} to your cart.`);
      setQuantity(1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn’t add this item. Please try again.");
    } finally {
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <form className={styles["cartForm"]} onSubmit={submit} aria-label={`Add ${name} to cart`} aria-busy={pending}>
      <NumberField aria-label={`Quantity for ${name}`} minValue={1} maxValue={maximum} step={1}
        value={quantity} onChange={(value) => { setQuantity(value); setError(""); setMessage(""); }}
        isDisabled={pending || available < 1 || !user} formatOptions={{ maximumFractionDigits: 0 }}>
        <Label>Quantity</Label>
        <NumberField.Group className={styles["quantityGroup"] ?? ""}>
          <NumberField.DecrementButton aria-label={`Decrease quantity for ${name}`} className={styles["quantityStep"] ?? ""} />
          <NumberField.Input className={styles["quantityInput"] ?? ""} />
          <NumberField.IncrementButton aria-label={`Increase quantity for ${name}`} className={styles["quantityStep"] ?? ""} />
        </NumberField.Group>
      </NumberField>
      <Button type="submit" variant="secondary" fullWidth isPending={pending} isDisabled={!user || available < 1}
        aria-label={stock < 1 ? `${name} is sold out` : `Add ${name} to cart`} className={styles["addButton"] ?? ""}>
        {pending ? "Adding…" : stock < 1 ? "Sold out" : available < 1 ? "All stock in cart" : "Add to cart"}
      </Button>
      <div className={styles["cartFeedback"]}>
        <p role="status" aria-live="polite">{message}</p>
        {error && <p role="alert" className={styles["cartError"]}>{error}</p>}
      </div>
    </form>
  );
}
