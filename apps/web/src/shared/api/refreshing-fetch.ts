/** Cookie authentication transport. Only a definitive 401 may replay a request. */
export function createRefreshingFetch(send: typeof fetch = globalThis.fetch) {
  let pending: Promise<Response> | null = null;
  let generation = 0;

  function renew(origin: string): Promise<Response> {
    if (pending) return pending;
    const attempt = send(new Request(`${origin}/api/auth/refresh`, {
      method: "POST", credentials: "include", cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    })).then((response) => {
      if (response.ok) generation++;
      return response;
    });
    pending = attempt;
    void attempt.finally(() => { if (pending === attempt) pending = null; }).catch(() => {});
    return attempt;
  }

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const authentication = url.pathname.startsWith("/api/auth/");
    const started = generation;
    // Save the body before fetch consumes it (including POST cart additions).
    const replay = authentication ? null : request.clone();
    const response = await send(request);
    if (authentication) {
      if (url.pathname === "/api/auth/login" && response.ok) generation++;
      return response;
    }
    if (response.status !== 401 || !replay) return response;

    if (started === generation) {
      const renewal = await renew(url.origin);
      if (renewal.status === 401) return response;
      if (renewal.status === 403) return renewal.clone();
      if (!renewal.ok) throw new Error("Session renewal unavailable");
    }
    request.signal.throwIfAborted();
    // Use the raw transport so a second 401 cannot start a refresh loop.
    return send(replay);
  };
}
