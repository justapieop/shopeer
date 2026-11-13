import { api } from "@/shared/api";
import type { components } from "@shopeer/web-lib";

export type Cart = components["schemas"]["CartResponseDto"];

export async function addCartItem(productId: string, quantity: number): Promise<Cart> {
  let result;
  try {
    result = await api.POST("/cart/items", { body: { productId, quantity } });
  } catch {
    // A disconnected response does not prove that the write failed. Never retry it automatically.
    throw new Error("Couldn’t confirm the addition. It may already be in your cart.");
  }
  if (!result.response.ok || !result.data) {
    switch (result.response.status) {
      case 401: throw new Error("Your session expired. Please log in again.");
      case 403: throw new Error("You don’t have permission to add items to this cart.");
      case 404: throw new Error("This product is no longer available.");
      case 409: throw new Error("Not enough stock, including items already in your cart. Try a smaller quantity.");
      case 400: throw new Error("Choose a valid whole-number quantity.");
      default: throw new Error("Couldn’t add this item. Please try again in a moment.");
    }
  }
  return result.data;
}
