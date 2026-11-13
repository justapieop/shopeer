import { OrdersPage } from "@/_pages/orders";
export const metadata = { title: "Delivery details · Shopeer" };
export default async function Page({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  return <OrdersPage mode="handler" orderId={orderId} />;
}
