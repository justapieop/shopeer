import type { createApiClient } from "@shopeer/web-lib";
import type { SessionStore } from "./session-store";

type ApiMiddleware = Parameters<ReturnType<typeof createApiClient>["use"]>[number];

export function createSessionMiddleware(store: SessionStore): ApiMiddleware {
  const requests = new Map<string, number>();
  return {
    onRequest({ id }) { requests.set(id, store.getVersion()); },
    onResponse({ id, response, schemaPath }) {
      const version = requests.get(id);
      requests.delete(id);
      if (response.status === 401 && schemaPath !== "/auth/login" && version === store.getVersion()) {
        store.clearSession();
      }
    },
    onError({ id }) { requests.delete(id); },
  };
}
