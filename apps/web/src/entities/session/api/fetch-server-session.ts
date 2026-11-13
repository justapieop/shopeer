import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createApiClient } from "@shopeer/web-lib";

/** Request-local validation only: never put authenticated user data in the public cache. */
export const fetchServerSession = cache(async () => {
  const token = (await cookies()).get("access_token");
  if (!token?.value) return null;
  const client = createApiClient({
    baseUrl: (process.env["API_URL"] ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
  });
  const { data, response } = await client.GET("/user/me", {
    headers: { Cookie: `access_token=${token.value}` },
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  if (response.status === 401 || response.status === 403) return null;
  if (!response.ok || !data) throw new Error("Session verification unavailable");
  return data;
});
