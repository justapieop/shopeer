import "server-only";
import { cache } from "react";
import { createApiClient } from "@shopeer/web-lib";
import { PAGE_SIZE } from "../model/catalog-query";

function catalogClient(revalidate: number) {
  return createApiClient({
    baseUrl: (process.env["API_URL"] ?? "http://127.0.0.1:3001").replace(/\/$/, ""),
    credentials: "omit",
    // The SDK constructs a Request, so attach Next's cache options at fetch time.
    fetch: (input) => fetch(input, {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate, tags: ["catalog"] },
    }),
  });
}

export const fetchProducts = cache(async (page: number, categoryId: string) => {
  const { data, response } = await catalogClient(60).GET("/products", {
    params: { query: { page, limit: PAGE_SIZE, ...(categoryId ? { categoryId } : {}) } },
  });
  if (!response.ok || !data) throw new Error(response.status === 404 ? "category-not-found" : "catalog-unavailable");
  return data;
});

export const fetchCategories = cache(async () => {
  const { data, response } = await catalogClient(300).GET("/categories");
  if (!response.ok || !data) throw new Error("categories-unavailable");
  return data;
});
