"use client";

import { Button, FieldError, Input, Label, TextField } from "@heroui/react";
import { ArrowLeft, ArrowRight, Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { login } from "../api/login";
import { returnDestination } from "../lib/return-destination";
import { useSession } from "@/entities/session";
import styles from "./login-page.module.css";

export function LoginPage() {
  const router = useRouter();
  const { setUser, refresh, status, user, error: sessionError } = useSession();
  const [sessionChecked, setSessionChecked] = useState(false);
  const submitting = useRef(false);
  const [pending, setPending] = useState(false);
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState("");

  // Server Components cannot persist renewed cookies. Recover in the browser
  // before returning to a protected destination whose access cookie has expired.
  useEffect(() => {
    const destination = new URL(window.location.href).searchParams.get("next");
    if (!["store", "cart", "orders", "seller-orders"].includes(destination ?? "")) return;
    let active = true;
    void refresh(true).then(() => { if (active) setSessionChecked(true); });
    return () => { active = false; };
  }, [refresh]);

  useEffect(() => {
    if (sessionChecked && status === "authenticated" && user && !user.suspended && !sessionError) {
      // A failed verification can retain a cached user; only return after success.
      router.replace(returnDestination(new URL(window.location.href).searchParams));
    }
  }, [sessionChecked, status, user, sessionError, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    const data = new FormData(event.currentTarget);
    submitting.current = true;
    setPending(true);
    setError("");
    try {
      const user = await login(String(data.get("username") ?? "").trim(), String(data.get("password") ?? ""));
      setUser(user);
      router.replace(returnDestination(new URL(window.location.href).searchParams));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Please try again.");
      submitting.current = false;
      setPending(false);
    }
  }

  return (
    <div className={styles["page"]}>
      <header className={styles["header"]}>
        <Link href="/" className={styles["wordmark"]} aria-label="Shopeer home">shopeer</Link>
        <Link href="/" className={styles["back"]}><ArrowLeft size={16} aria-hidden="true" /> Back to home</Link>
      </header>
      <main className={styles["main"]}>
        <section className={styles["panel"]} aria-labelledby="login-title">
          <h1 id="login-title">Log in to Shopeer</h1>
          <p className={styles["intro"]}>Your next everyday find is waiting.</p>
          <form onSubmit={handleSubmit} className={styles["form"]} aria-busy={pending}>
            <TextField name="username" isRequired maxLength={256} isReadOnly={pending} validate={(value) => value.trim() ? null : "Enter your username."}>
              <Label>Username</Label>
              <Input autoComplete="username" className={styles["input"] ?? ""} />
              <FieldError />
            </TextField>
            <TextField name="password" isRequired maxLength={1024} isReadOnly={pending} validate={(value) => value.trim() ? null : "Enter your password."}>
              <Label>Password</Label>
              <div className={styles["password"]}>
                <Input type={visible ? "text" : "password"} autoComplete="current-password" className={styles["input"] ?? ""} />
                <Button type="button" variant="ghost" isIconOnly aria-label={visible ? "Hide password" : "Show password"} aria-pressed={visible} onPress={() => setVisible(!visible)} className={styles["reveal"] ?? ""}>
                  {visible ? <EyeOff size={18} /> : <Eye size={18} />}
                </Button>
              </div>
              <FieldError />
            </TextField>
            {error && <p role="alert" className={styles["error"]}>{error}</p>}
            <Button type="submit" fullWidth isPending={pending} className={styles["submit"] ?? ""}>
              {pending ? "Logging in…" : "Log in"}
              {!pending && <ArrowRight size={18} aria-hidden="true" />}
            </Button>
          </form>
        </section>
      </main>
      <footer className={styles["footer"]}>Shopping, made simple.</footer>
    </div>
  );
}

