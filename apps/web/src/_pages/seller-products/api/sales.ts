import { api } from "@/shared/api";
import type { components } from "@shopeer/web-lib";

export type SellerProduct = components["schemas"]["SellerProductResponseDto"];
export type NewProduct = components["schemas"]["PostProductDto"];
export type NewPeriod = components["schemas"]["PublishPeriodDto"];
export class SalesError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}
function fail(status: number): never {
  throw new SalesError(status === 403 ? "Your account needs Sell permission to manage products."
    : status === 404 ? "The product or category is unavailable."
    : status === 409 ? "This product already has an active period. Refresh to see its latest stock."
    : status === 400 ? "Check your fields. Quantities must be whole numbers and the end date must be in the future."
    : "We couldn’t confirm the result. Refresh and review your products before posting again.", status);
}
export async function fetchProducts(page: number, signal: AbortSignal): Promise<SellerProduct[]> {
  const result = await api.GET("/seller/products", { params: { query: { page, limit: 20 } }, cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (!result.response.ok || !result.data) fail(result.response.status);
  return result.data;
}
export async function fetchCategories(signal: AbortSignal) {
  const result = await api.GET("/categories", { signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) });
  if (!result.response.ok || !result.data) fail(result.response.status);
  return result.data;
}
export async function postProduct(body: NewProduct) {
  const result = await api.POST("/seller/products", { body, signal: AbortSignal.timeout(15000) });
  if (!result.response.ok || !result.data) fail(result.response.status);
  return result.data;
}
export async function postPeriod(productId: string, body: NewPeriod) {
  const result = await api.POST("/seller/products/{productId}/periods", { params: { path: { productId } }, body, signal: AbortSignal.timeout(15000) });
  if (!result.response.ok || !result.data) fail(result.response.status);
  return result.data;
}
