import type { components } from "@shopeer/web-lib";

export type SessionUser = components["schemas"]["UserResponseDto"];
export type SessionSnapshot = {
  user: SessionUser | null;
  status: "loading" | "authenticated" | "anonymous" | "error";
  error: string | null;
};

const CACHE_MS = 5 * 60 * 1000;
const RETRY_MS = 30 * 1000;

/** One in-memory cache per provider; no timers, storage, or server-side user state. */
export function createSessionStore(fetchUser: () => Promise<SessionUser | null>, now = Date.now) {
  let snapshot: SessionSnapshot = { user: null, status: "loading", error: null };
  const initialSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let expiresAt = 0;
  let version = 0;
  let pending: Promise<void> | null = null;

  function publish(next: SessionSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  function setUser(user: SessionUser | null) {
    version++;
    pending = null;
    expiresAt = now() + CACHE_MS;
    publish({ user, status: user ? "authenticated" : "anonymous", error: null });
  }

  function refresh(force = false): Promise<void> {
    if (pending) return pending;
    if (!force && now() < expiresAt) return Promise.resolve();
    const requestVersion = version;
    const request = (async () => {
      try {
        const user = await fetchUser();
        if (version !== requestVersion) return;
        expiresAt = now() + CACHE_MS;
        publish({ user, status: user ? "authenticated" : "anonymous", error: null });
      } catch {
        if (version !== requestVersion) return;
        // An outage or a 403 is not proof that the cookie is invalid.
        expiresAt = now() + RETRY_MS;
        publish({ ...snapshot, status: snapshot.user ? "authenticated" : "error", error: "Couldn’t check your session. Please try again." });
      }
    })();
    pending = request;
    void request.finally(() => { if (pending === request) pending = null; });
    return request;
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    getVersion: () => version,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    refresh,
    setUser,
    clearSession: () => setUser(null),
  };
}

export type SessionStore = ReturnType<typeof createSessionStore>;
