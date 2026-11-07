import { api } from "@/shared/api";
import type { components } from "@shopeer/web-lib";

export type Order = components["schemas"]["OrderResponseDto"];
export type OrderMode = "buyer" | "seller";
export class OrderViewError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

export async function fetchOrders(mode: OrderMode, page: number, orderId: string | undefined, signal: AbortSignal): Promise<Order[]> {
  const options = { cache: "no-store" as const, signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]) };
  const result = orderId
    ? mode === "buyer" ? await api.GET("/orders/{orderId}", { ...options, params: { path: { orderId } } })
      : await api.GET("/seller/orders/{orderId}", { ...options, params: { path: { orderId } } })
    : mode === "buyer" ? await api.GET("/orders", { ...options, params: { query: { page, limit: 20 } } })
      : await api.GET("/seller/orders", { ...options, params: { query: { page, limit: 20 } } });
  if (!result.response.ok || !result.data) {
    const status = result.response.status;
    throw new OrderViewError(status === 403 ? `Your account doesn’t have permission to view ${mode === "seller" ? "seller" : "buyer"} orders.`
      : status === 404 ? "Order not found." : "We couldn’t load your orders. Please try again.", status);
  }
  return Array.isArray(result.data) ? result.data : [result.data];
}
