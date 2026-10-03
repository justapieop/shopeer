import {
  EmptyCartError,
  InvalidParametersError,
  NotFoundError,
  Order,
  OrderItem,
  OutOfStockError,
  Product,
} from "@shopeer/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartUseCase } from "../src/cart.js";
import { OrderUseCase } from "../src/order.js";
import {
  InMemoryCartItemRepository,
  InMemoryCartRepository,
  InMemoryOrderRepository,
  InMemoryProductRepository,
  InMemoryUserRepository,
  SequentialIdGenerator,
  makeProduct,
  makeUser,
  productDetails,
} from "./fakes.js";

describe("OrderUseCase", () => {
  let products: InMemoryProductRepository;
  let cartItems: InMemoryCartItemRepository;
  let orders: InMemoryOrderRepository;
  let cartUseCase: CartUseCase;
  let orderUseCase: OrderUseCase;

  beforeEach(() => {
    const ids: SequentialIdGenerator = new SequentialIdGenerator();
    const carts: InMemoryCartRepository = new InMemoryCartRepository();
    const users: InMemoryUserRepository = new InMemoryUserRepository();
    products = new InMemoryProductRepository();
    cartItems = new InMemoryCartItemRepository();
    orders = new InMemoryOrderRepository(products, cartItems);
    cartUseCase = new CartUseCase(carts, cartItems, products, users, ids);
    orderUseCase = new OrderUseCase(carts, cartItems, products, orders, ids);

    users.save(makeUser("alice"));
    users.save(makeUser("bob"));
    products.save(makeProduct("shirt", 100_000, 10));
    products.save(makeProduct("book", 50_000, 1));
  });

  describe("checkout", () => {
    it("rejects a user without a cart", async () => {
      await expect(orderUseCase.checkout("alice")).rejects.toBeInstanceOf(EmptyCartError);
    });

    it("rejects an empty cart", async () => {
      await cartUseCase.getCart("alice");

      await expect(orderUseCase.checkout("alice")).rejects.toBeInstanceOf(EmptyCartError);
    });

    it("turns the cart into an order, takes the stock and empties the cart", async () => {
      await cartUseCase.addItem("alice", "shirt", 3);
      await cartUseCase.addItem("alice", "book", 1);

      const order: Order = await orderUseCase.checkout("alice");

      expect(order.userId).toBe("alice");
      expect(order.items).toHaveLength(2);
      expect(order.totalAmount).toBe(3 * 100_000 + 50_000);
      expect(products.fetchProductById("shirt")!.stock).toBe(7);
      expect(products.fetchProductById("book")!.stock).toBe(0);
      expect((await cartUseCase.getCart("alice")).lines).toEqual([]);
    });

    it("keeps the price paid even if the product price changes later", async () => {
      await cartUseCase.addItem("alice", "shirt", 1);
      const order: Order = await orderUseCase.checkout("alice");

      const shirt: Product = products.fetchProductById("shirt")!;
      products.save(new Product({ ...productDetails(shirt), price: 999_000, }));

      const stored: Order = await orderUseCase.getOrder("alice", order.orderId);
      expect(stored.items[0]!.unitPrice).toBe(100_000);
    });

    it("fails fast with every product that lacks stock, without placing the order", async () => {
      await cartUseCase.addItem("alice", "shirt", 5);
      await cartUseCase.addItem("alice", "book", 1);
      // Bob buys the last book in the meantime.
      await cartUseCase.addItem("bob", "book", 1);
      await orderUseCase.checkout("bob");

      const placeOrder = vi.spyOn(orders, "placeOrder");

      const error: unknown = await orderUseCase.checkout("alice").catch((e: unknown) => e);
      expect(error).toBeInstanceOf(OutOfStockError);
      expect((error as OutOfStockError).productIds).toEqual(["book"]);
      expect(placeOrder).not.toHaveBeenCalled();
      expect(products.fetchProductById("shirt")!.stock).toBe(10);
    });

    it("propagates OutOfStockError raised by the repository (the race-condition guard)", async () => {
      await cartUseCase.addItem("alice", "book", 1);
      // Simulates another buyer committing between our stock check and placeOrder.
      vi.spyOn(orders, "placeOrder").mockImplementation(() => {
        throw new OutOfStockError(["book"]);
      });

      await expect(orderUseCase.checkout("alice")).rejects.toBeInstanceOf(OutOfStockError);
      expect((await cartUseCase.getCart("alice")).lines).toHaveLength(1);
    });
  });

  describe("listOrders and getOrder", () => {
    it("lists only the user's own orders", async () => {
      await cartUseCase.addItem("alice", "shirt", 1);
      await orderUseCase.checkout("alice");
      await cartUseCase.addItem("bob", "shirt", 1);
      await orderUseCase.checkout("bob");

      const aliceOrders: Order[] = await orderUseCase.listOrders("alice");
      expect(aliceOrders).toHaveLength(1);
      expect(aliceOrders[0]!.userId).toBe("alice");
    });

    it("hides other users' orders", async () => {
      await cartUseCase.addItem("alice", "shirt", 1);
      const order: Order = await orderUseCase.checkout("alice");

      await expect(orderUseCase.getOrder("bob", order.orderId)).rejects.toBeInstanceOf(NotFoundError);
    });
  });
});

describe("Order (domain)", () => {
  const item = (orderId: string, productId: string): OrderItem =>
    new OrderItem({ orderItemId: `i-${productId}`, orderId, productId, unitPrice: 10_000, quantity: 2, });

  it("computes the total from its items", () => {
    const order: Order = new Order({ orderId: "o1", userId: "u1", items: [item("o1", "a"), item("o1", "b")], });

    expect(order.totalAmount).toBe(40_000);
  });

  it("requires at least one item", () => {
    expect(() => new Order({ orderId: "o1", userId: "u1", items: [], })).toThrow(InvalidParametersError);
  });

  it("rejects the same product twice", () => {
    expect(() => new Order({ orderId: "o1", userId: "u1", items: [item("o1", "a"), item("o1", "a")], }))
      .toThrow(InvalidParametersError);
  });

  it("rejects items of another order", () => {
    expect(() => new Order({ orderId: "o1", userId: "u1", items: [item("o2", "a")], })).toThrow(InvalidParametersError);
  });
});
