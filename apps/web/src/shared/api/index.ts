import { createApiClient } from "@shopeer/web-lib";
import { createRefreshingFetch } from "./refreshing-fetch";

/** Browser API calls use the storefront origin so its HttpOnly cookie is included. */
export const api = createApiClient({ baseUrl: "/api", fetch: createRefreshingFetch() });
