import { InvalidParametersError, NotFoundError, OutOfStockError } from "@shopeer/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartUseCase, type CartView } from "../src/cart.js";
import {
  InMemoryCartItemRepository,
  InMemoryCartRepository,
  InMemoryProductRepository,
  InMemoryUserRepository,
  InMemoryOrderRepository,
  InMemoryUnitOfWork,
  SequentialIdGenerator,
  makeProduct,
  makeUser,
} from "./fakes.js";

describe("CartUseCase", () => {
  let carts: InMemoryCartRepository;
  let cartItems: InMemoryCartItemRepository;
  let products: InMemoryProductRepository;
  let users: InMemoryUserRepository;
  let useCase: CartUseCase;

  beforeEach(() => {
    carts = new InMemoryCartRepository();
    cartItems = new InMemoryCartItemRepository();
    products = new InMemoryProductRepository();
    users = new InMemoryUserRepository();
    useCase = new CartUseCase(
      new InMemoryUnitOfWork(carts, cartItems, products, new InMemoryOrderRepository(products, cartItems), users),
      new SequentialIdGenerator(),
    );

    users.save(makeUser("alice"));
    products.save(makeProduct("shirt", 100_000, 10));
    products.save(makeProduct("book", 50_000, 1));
  });

  describe("getCart", () => {
    it("creates an empty cart on first use", async () => {
      const view: CartView = await useCase.getCart("alice");

      expect(view.cart.userId).toBe("alice");
      expect(view.lines).toEqual([]);
      expect(view.totalAmount).toBe(0);
      expect(carts.carts.size).toBe(1);
    });

    it("returns the same cart on later calls", async () => {
      const first: CartView = await useCase.getCart("alice");
      const second: CartView = await useCase.getCart("alice");

      expect(second.cart.cartId).toBe(first.cart.cartId);
      expect(carts.carts.size).toBe(1);
    });

    it("rejects an unknown user", async () => {
      await expect(useCase.getCart("nobody")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rolls back a newly created cart when loading its view fails", async () => {
      const failure = new Error("could not load products");
      vi.spyOn(products, "fetchProductsByIds").mockImplementationOnce(() => { throw failure; });
      await expect(useCase.getCart("alice")).rejects.toBe(failure);
      expect(carts.carts.size).toBe(0);
    });
  });

  describe("addItem", () => {
    it("adds a product and computes the totals", async () => {
      const view: CartView = await useCase.addItem("alice", "shirt", 2);

      expect(view.lines).toHaveLength(1);
      expect(view.lines[0]!.item.quantity).toBe(2);
      expect(view.lines[0]!.subtotal).toBe(200_000);
      expect(view.totalQuantity).toBe(2);
      expect(view.totalAmount).toBe(200_000);
    });

    it("adds up quantities when the product is already in the cart", async () => {
      await useCase.addItem("alice", "shirt", 2);
      const view: CartView = await useCase.addItem("alice", "shirt", 3);

      expect(view.lines).toHaveLength(1);
      expect(view.lines[0]!.item.quantity).toBe(5);
    });

    it("sums several products", async () => {
      await useCase.addItem("alice", "shirt", 2);
      const view: CartView = await useCase.addItem("alice", "book", 1);

      expect(view.totalQuantity).toBe(3);
      expect(view.totalAmount).toBe(250_000);
    });

    it.each([0, -1, 1.5])("rejects quantity %s", async (quantity: number) => {
      await expect(useCase.addItem("alice", "shirt", quantity)).rejects.toBeInstanceOf(InvalidParametersError);
    });

    it("rejects an unknown product", async () => {
      await expect(useCase.addItem("alice", "ghost", 1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects more than the stock", async () => {
      await expect(useCase.addItem("alice", "shirt", 11)).rejects.toBeInstanceOf(OutOfStockError);
      expect(carts.carts.size).toBe(0);
      expect(cartItems.items.size).toBe(0);
    });

    it("counts what is already in the cart against the stock", async () => {
      await useCase.addItem("alice", "shirt", 8);

      await expect(useCase.addItem("alice", "shirt", 3)).rejects.toBeInstanceOf(OutOfStockError);
      expect((await useCase.getCart("alice")).lines[0]!.item.quantity).toBe(8);
    });
  });

  describe("updateItemQuantity", () => {
    it("sets the new quantity", async () => {
      await useCase.addItem("alice", "shirt", 2);
      const view: CartView = await useCase.updateItemQuantity("alice", "shirt", 7);

      expect(view.lines[0]!.item.quantity).toBe(7);
    });

    it("rejects a product that is not in the cart", async () => {
      await expect(useCase.updateItemQuantity("alice", "shirt", 1)).rejects.toBeInstanceOf(NotFoundError);
    });

    it("rejects more than the stock", async () => {
      await useCase.addItem("alice", "shirt", 2);

      await expect(useCase.updateItemQuantity("alice", "shirt", 11)).rejects.toBeInstanceOf(OutOfStockError);
    });

    it("rejects quantity 0 (use removeItem instead)", async () => {
      await useCase.addItem("alice", "shirt", 2);

      await expect(useCase.updateItemQuantity("alice", "shirt", 0)).rejects.toBeInstanceOf(InvalidParametersError);
    });
  });

  describe("removeItem and clearCart", () => {
    it.each(["add", "update", "remove", "clear"])("rolls back %s when building the response fails", async (operation) => {
      await useCase.addItem("alice", "shirt", 2);
      const failure = new Error("response lookup failed");
      vi.spyOn(products, "fetchProductsByIds").mockImplementationOnce(() => { throw failure; });
      const write = {
        add: () => useCase.addItem("alice", "shirt", 1),
        update: () => useCase.updateItemQuantity("alice", "shirt", 3),
        remove: () => useCase.removeItem("alice", "shirt"),
        clear: () => useCase.clearCart("alice"),
      }[operation]!;
      await expect(write()).rejects.toBe(failure);
      expect((await useCase.getCart("alice")).lines[0]!.item.quantity).toBe(2);
    });
    it("removes one product", async () => {
      await useCase.addItem("alice", "shirt", 2);
      await useCase.addItem("alice", "book", 1);
      const view: CartView = await useCase.removeItem("alice", "shirt");

      expect(view.lines.map((line) => line.product.productId)).toEqual(["book"]);
    });

    it("rejects removing a product that is not in the cart", async () => {
      await expect(useCase.removeItem("alice", "shirt")).rejects.toBeInstanceOf(NotFoundError);
    });

    it("empties the cart", async () => {
      await useCase.addItem("alice", "shirt", 2);
      await useCase.addItem("alice", "book", 1);
      const view: CartView = await useCase.clearCart("alice");

      expect(view.lines).toEqual([]);
      expect(view.totalAmount).toBe(0);
    });
  });
});
