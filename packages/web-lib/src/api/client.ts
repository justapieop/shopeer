import createClient, { type ClientOptions } from "openapi-fetch";
import type { paths } from "./schema";

/** Creates a typed API client; browser requests include the authentication cookie. */
export function createApiClient(options: ClientOptions & { baseUrl: string }) {
  return createClient<paths>({ credentials: "include", ...options });
}
