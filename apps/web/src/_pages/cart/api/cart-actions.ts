import { api } from "@/shared/api";
import { CartActionError, type CartAction, type Cart, type Order } from "../model/cart-store";

export async function mutateCart(action: CartAction): Promise<{ cart: Cart } | { order: Order }> {
  let result;
  try {
    const signal = AbortSignal.timeout(10_000);
    if (action.type === "checkout") result = await api.POST("/checkout", { signal });
    else if (action.type === "remove") result = await api.DELETE("/cart/items/{productId}", { params: { path: { productId: action.productId } }, signal });
    else result = await api.PATCH("/cart/items/{productId}", { params: { path: { productId: action.productId } }, body: { quantity: action.quantity }, signal });
  } catch {
    throw new CartActionError(action.type === "checkout"
      ? "We couldn’t confirm checkout. It may have succeeded. Refresh your cart before placing another order."
      : "We couldn’t confirm the change. Refresh your cart before trying again.");
  }
  const status = result.response.status;
  if (!result.response.ok || !result.data) {
    const message = status === 409
      ? "Your cart or available stock changed. Review the latest cart before trying again."
      : status === 404 ? "This product is no longer in your cart. Review the latest cart."
      : status === 401 ? "Your session expired. Please log in again."
      : status === 403 ? "You don’t have permission to perform this action."
      : status === 400 ? "Choose a valid whole-number quantity."
      : "We couldn’t confirm the request. Refresh your cart before trying again.";
    throw new CartActionError(message, status >= 400 ? status : undefined);
  }
  return action.type === "checkout" ? { order: result.data as Order } : { cart: result.data as Cart };
}
