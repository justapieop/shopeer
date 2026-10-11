import {
  EmptyCartError,
  CartChangedError,
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
  InMemoryUnitOfWork,
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
    const unitOfWork = new InMemoryUnitOfWork(carts, cartItems, products, orders, users);
    cartUseCase = new CartUseCase(unitOfWork, ids);
    orderUseCase = new OrderUseCase(unitOfWork, orders, ids);

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

    it("rolls back stock, saved orders and cleared cart lines after a late failure", async () => {
      await cartUseCase.addItem("alice", "shirt", 2);
      const placeOrder = orders.placeOrder.bind(orders);
      const failure = new Error("failure after persistence");
      vi.spyOn(orders, "placeOrder").mockImplementation((order, cartId) => {
        placeOrder(order, cartId);
        throw failure;
      });

      await expect(orderUseCase.checkout("alice")).rejects.toBe(failure);
      expect(products.fetchProductById("shirt")!.stock).toBe(10);
      expect(orders.orders.size).toBe(0);
      expect((await cartUseCase.getCart("alice")).lines[0]!.item.quantity).toBe(2);
    });

    it("rejects an ordered cart line changed after the initial read", async () => {
      await cartUseCase.addItem("alice", "shirt", 1);
      const fetchProducts = products.fetchProductsByIds.bind(products);
      vi.spyOn(products, "fetchProductsByIds").mockImplementationOnce((ids) => {
        const item = [...cartItems.items.values()][0]!;
        cartItems.save(item.withQuantity(2));
        return fetchProducts(ids);
      });

      await expect(orderUseCase.checkout("alice")).rejects.toBeInstanceOf(CartChangedError);
      expect(products.fetchProductById("shirt")!.stock).toBe(10);
      expect(orders.orders.size).toBe(0);
    });

    it("allows only one competing buyer to purchase the last unit", async () => {
      await cartUseCase.addItem("alice", "book", 1);
      await cartUseCase.addItem("bob", "book", 1);
      const results = await Promise.allSettled([
        orderUseCase.checkout("alice"), orderUseCase.checkout("bob"),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((result) => result.status === "rejected");
      expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(OutOfStockError);
      expect(products.fetchProductById("book")!.stock).toBe(0);
      expect(orders.orders.size).toBe(1);
      expect(cartItems.items.size).toBe(1);
    });

    it("uses the callback's order repository for writes and the normal repository for reads", async () => {
      await cartUseCase.addItem("alice", "shirt", 1);
      const readOnlyOrders = {
        placeOrder: vi.fn(() => { throw new Error("write outside transaction"); }),
        fetchOrderById: orders.fetchOrderById.bind(orders),
        fetchOrdersByUserId: orders.fetchOrdersByUserId.bind(orders),
      };
      const carts = new InMemoryCartRepository();
      const cart = await cartUseCase.getCart("alice");
      carts.save(cart.cart);
      const useCase = new OrderUseCase(
        new InMemoryUnitOfWork(carts, cartItems, products, orders),
        readOnlyOrders, new SequentialIdGenerator(),
      );
      const order = await useCase.checkout("alice");
      expect(readOnlyOrders.placeOrder).not.toHaveBeenCalled();
      expect(await useCase.getOrder("alice", order.orderId)).toBe(order);
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

  // Each rule test checks the message too: any InvalidParametersError would
  // otherwise make it pass, even one raised by an unrelated rule.
  const expectRule = (create: () => Order, message: string): void => {
    expect(create).toThrow(InvalidParametersError);
    expect(create).toThrow(message);
  };

  it("computes the total from its items", () => {
    const order: Order = new Order({ orderId: "o1", userId: "u1", cartId: "c1", status: "pending", items: [item("o1", "a"), item("o1", "b")], });

    expect(order.totalAmount).toBe(40_000);
  });

  it("requires at least one item", () => {
    expectRule(
      () => new Order({ orderId: "o1", userId: "u1", cartId: "c1", status: "pending", items: [], }),
      "an order must have at least one item",
    );
  });

  it("rejects the same product twice", () => {
    expectRule(
      () => new Order({ orderId: "o1", userId: "u1", cartId: "c1", status: "pending", items: [item("o1", "a"), item("o1", "a")], }),
      "a product must appear only once per order",
    );
  });

  it("rejects items of another order", () => {
    expectRule(
      () => new Order({ orderId: "o1", userId: "u1", cartId: "c1", status: "pending", items: [item("o2", "a")], }),
      "every item must belong to this order",
    );
  });

  it("rejects an unknown status", () => {
    expectRule(
      () => new Order({ orderId: "o1", userId: "u1", cartId: "c1", status: "paid" as Order["status"], items: [item("o1", "a")], }),
      "status must be one of: pending, completed, cancelled",
    );
  });
});
