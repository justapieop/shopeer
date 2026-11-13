import { api } from "@/shared/api";
import type { components } from "@shopeer/web-lib";

export type Cart = components["schemas"]["CartResponseDto"];

export async function fetchCart(signal: AbortSignal): Promise<Cart> {
  const { data, response } = await api.GET("/cart", {
    cache: "no-store", signal: AbortSignal.any([signal, AbortSignal.timeout(8_000)]),
  });
  if (response.status === 403) throw new Error("You don’t have permission to view this cart.");
  if (!response.ok || !data) throw new Error("We couldn’t load your cart. Please try again.");
  return data;
}
