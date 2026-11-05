"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { SessionProvider } from "@/entities/session";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <SessionProvider>{children}</SessionProvider>
    </ThemeProvider>
  );
}
