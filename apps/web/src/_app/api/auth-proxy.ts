/** Adapt the backend's auth cookies to the storefront's /api namespace. */
export async function proxyAuth(request: Request, endpoint: "login" | "refresh"): Promise<Response> {
  const headers = new Headers();
  for (const name of ["content-type", "cookie"]) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  let upstream: Response;
  try {
    const baseUrl = (process.env["API_URL"] ?? "http://127.0.0.1:3001").replace(/\/$/, "");
    upstream = await fetch(`${baseUrl}/auth/${endpoint}`, {
      method: "POST", headers, body: await request.text(),
      cache: "no-store", redirect: "manual", signal: AbortSignal.timeout(8_000),
    });
  } catch {
    return Response.json({ message: "Authentication service unavailable" }, { status: 502, headers: { "Cache-Control": "no-store" } });
  }
  const responseHeaders = new Headers({ "Cache-Control": "no-store" });
  const contentType = upstream.headers.get("content-type");
  if (contentType) responseHeaders.set("Content-Type", contentType);
  for (const cookie of upstream.headers.getSetCookie()) {
    responseHeaders.append("Set-Cookie", cookie.startsWith("refresh_token=")
      ? cookie.replace(/;\s*Path=\/auth\/refresh(?=;|$)/i, "; Path=/api/auth/refresh")
      : cookie);
  }
  return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
}

export const login = (request: Request) => proxyAuth(request, "login");
export const refresh = (request: Request) => proxyAuth(request, "refresh");
