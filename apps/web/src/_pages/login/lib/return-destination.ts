export function returnDestination(params: URLSearchParams): string {
  const next = params.get("next");
  if (next === "seller-products") return "/seller/products";
  if (next === "store") return "/store";
  if (next === "cart") return "/cart";
  if (next === "orders" || next === "seller-orders" || next === "handler-orders") {
    const base = next === "orders" ? "/orders" : next === "handler-orders" ? "/handler/orders" : "/seller/orders";
    const orderId = params.get("orderId");
    return orderId && orderId.length <= 256 ? `${base}/${encodeURIComponent(orderId)}` : base;
  }
  return "/";
}
