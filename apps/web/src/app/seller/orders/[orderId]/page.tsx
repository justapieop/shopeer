import { OrdersPage } from "@/_pages/orders";
export const metadata = { title: "Seller order details · Shopeer" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrdersPage mode="seller" orderId={orderId} />;
}
