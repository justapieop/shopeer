"use client";

import { createContext, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/shared/api";
import { fetchSession } from "../api/fetch-session";
import { createSessionStore, type SessionStore } from "./session-store";
import { createSessionMiddleware } from "./session-middleware";

const SessionContext = createContext<SessionStore | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [store] = useState(() => createSessionStore(fetchSession));
  const pathname = usePathname();

  useEffect(() => {
    const middleware = createSessionMiddleware(store);
    api.use(middleware);
    const revalidate = () => { if (document.visibilityState === "visible") void store.refresh(); };
    window.addEventListener("focus", revalidate);
    window.addEventListener("online", revalidate);
    document.addEventListener("visibilitychange", revalidate);
    return () => {
      api.eject(middleware);
      window.removeEventListener("focus", revalidate);
      window.removeEventListener("online", revalidate);
      document.removeEventListener("visibilitychange", revalidate);
    };
  }, [store]);

  useEffect(() => { void store.refresh(); }, [store, pathname]);

  return <SessionContext value={store}>{children}</SessionContext>;
}

export function useSession() {
  const store = useContext(SessionContext);
  if (!store) throw new Error("useSession must be used within SessionProvider");
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot);
  return { ...snapshot, setUser: store.setUser, clearSession: store.clearSession, refresh: store.refresh };
}
