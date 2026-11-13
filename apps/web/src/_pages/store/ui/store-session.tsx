"use client";

import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { useSession } from "@/entities/session";

/** The server already validated the initial render; react immediately to later 401s. */
export function StoreSession({ children }: { children: ReactNode }) {
  const { status } = useSession();
  if (status === "anonymous") redirect("/login?next=store");
  return children;
}
