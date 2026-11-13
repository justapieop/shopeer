import { describe, expect, it, vi } from "vitest";
import { ConflictError, NotFoundError, Order, OrderItem } from "@shopeer/domain";
import { OrderUseCase } from "../src/order.js";
import { InMemoryCartItemRepository, InMemoryCartRepository, InMemoryOrderRepository, InMemoryProductRepository, InMemoryUnitOfWork, SequentialIdGenerator } from "./fakes.js";

function setup(status: Order["status"] = "pending") {
  const products = new InMemoryProductRepository();
  const items = new InMemoryCartItemRepository();
  const orders = new InMemoryOrderRepository(products, items);
  orders.orders.set("order", new Order({
    orderId: "order", userId: "buyer", cartId: "cart", status,
    items: [new OrderItem({ orderItemId: "line", orderId: "order", productId: "product", unitPrice: 100, quantity: 1 })],
  }));
  const useCase = new OrderUseCase(new InMemoryUnitOfWork(new InMemoryCartRepository(), items, products, orders), orders, new SequentialIdGenerator());
  return { orders, useCase };
}

describe("two-step order completion", () => {
  it("lists full orders across buyers with status filtering and pagination", async () => {
    const { orders, useCase } = setup();
    const original = orders.fetchOrderById("order")!;
    orders.orders.set("other", new Order({ orderId: "other", userId: "other-buyer", cartId: "other-cart", status: "delivered", items: [new OrderItem({ orderItemId: "other-line", orderId: "other", productId: "other-product", unitPrice: 200, quantity: 1 })], createdAt: new Date(original.createdAt.getTime() + 1000) }));
    expect((await useCase.listHandlerOrders()).map(order => order.orderId)).toEqual(["other", "order"]);
    expect((await useCase.listHandlerOrders({ page: 1, limit: 20 }, "pending")).map(order => order.orderId)).toEqual(["order"]);
    expect((await useCase.listHandlerOrders({ page: 2, limit: 1 })).map(order => order.orderId)).toEqual(["order"]);
    expect((await useCase.getHandlerOrder("other")).userId).toBe("other-buyer");
    await expect(useCase.getHandlerOrder("missing")).rejects.toBeInstanceOf(NotFoundError);
  });
  it("requires handler delivery followed by buyer receipt, preserving the order contents", async () => {
    const { orders, useCase } = setup();
    const original = orders.fetchOrderById("order")!;
    await expect(useCase.confirmReceipt("buyer", "order")).rejects.toBeInstanceOf(ConflictError);
    expect((await useCase.confirmDelivery("order")).status).toBe("delivered");
    const completed = await useCase.confirmReceipt("buyer", "order");
    expect(completed.status).toBe("completed");
    expect(completed.items).toEqual(original.items);
    expect(completed.totalAmount).toBe(original.totalAmount);
    expect(completed.createdAt).toEqual(original.createdAt);
  });

  it("does not let another user confirm receipt or reveal the order", async () => {
    const { useCase } = setup("delivered");
    await expect(useCase.confirmReceipt("other", "order")).rejects.toBeInstanceOf(NotFoundError);
    await expect(useCase.confirmReceipt("buyer", "missing")).rejects.toBeInstanceOf(NotFoundError);
    await expect(useCase.confirmDelivery("missing")).rejects.toBeInstanceOf(NotFoundError);
  });

  it("never advances a cancelled order", async () => {
    const { orders, useCase } = setup("cancelled");
    await expect(useCase.confirmDelivery("order")).rejects.toBeInstanceOf(ConflictError);
    await expect(useCase.confirmReceipt("buyer", "order")).rejects.toBeInstanceOf(ConflictError);
    expect(orders.fetchOrderById("order")!.status).toBe("cancelled");
  });

  it("handles duplicate and concurrent confirmations without moving backward", async () => {
    const { useCase } = setup();
    expect((await Promise.all([useCase.confirmDelivery("order"), useCase.confirmDelivery("order")])).every(order => order.status === "delivered")).toBe(true);
    expect((await Promise.all([useCase.confirmReceipt("buyer", "order"), useCase.confirmReceipt("buyer", "order")])).every(order => order.status === "completed")).toBe(true);
    expect((await useCase.confirmDelivery("order")).status).toBe("completed");
  });

  it("rejects confirmation if a concurrent change cancels the order", async () => {
    const { orders, useCase } = setup("delivered");
    vi.spyOn(orders, "transitionStatus").mockImplementationOnce(() => {
      orders.orders.set("order", setup("cancelled").orders.fetchOrderById("order")!);
      return false;
    });
    await expect(useCase.confirmReceipt("buyer", "order")).rejects.toBeInstanceOf(ConflictError);
  });
});
