import { CartItem, Category, Transaction } from "@shopeer/domain";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CartItemUseCase } from "../src/cartItem.js";
import { CategoryUseCase } from "../src/category.js";
import { TransactionUseCase } from "../src/transaction.js";
import { UserUseCase } from "../src/user.js";
import type { RepositorySet, UnitOfWork } from "../src/ports.js";
import {
  InMemoryCartItemRepository, InMemoryCartRepository, InMemoryCategoryRepository,
  InMemoryOrderRepository, InMemoryProductRepository, InMemoryUnitOfWork,
  InMemoryUserRepository, makeUser,
} from "./fakes.js";

describe("save use cases", () => {
  let unitOfWork: InMemoryUnitOfWork;
  let users: InMemoryUserRepository;
  let categories: InMemoryCategoryRepository;
  let cartItems: InMemoryCartItemRepository;

  beforeEach(() => {
    users = new InMemoryUserRepository();
    categories = new InMemoryCategoryRepository();
    cartItems = new InMemoryCartItemRepository();
    const products = new InMemoryProductRepository();
    unitOfWork = new InMemoryUnitOfWork(
      new InMemoryCartRepository(), cartItems, products,
      new InMemoryOrderRepository(products, cartItems), users, categories,
    );
  });

  // Separate read providers reject writes. Saves must use callback repositories.
  const readProvider = <T extends object>(repository: T): T => Object.assign(
    Object.create(repository), { save: vi.fn(() => { throw new Error("write outside UoW"); }) },
  );
  const lateFailure = (failure: Error): UnitOfWork => ({
    execute: <T>(work: (repositories: RepositorySet) => Promise<T>) =>
      unitOfWork.execute(async (repositories) => {
        await work(repositories);
        throw failure;
      }),
  });

  it("saves users through the scope and reads users without opening a transaction", async () => {
    const execute = vi.spyOn(unitOfWork, "execute");
    const useCase = new UserUseCase(unitOfWork, readProvider(users));
    const user = makeUser("alice");
    expect(await useCase.save(user)).toBe(user);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(await useCase.fetchUserById("alice")).toBe(user);
    expect(await useCase.fetchUserByUsername("alice")).toBe(user);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("rolls back a user registration when the transaction fails after save", async () => {
    const failure = new Error("commit failed");
    await expect(new UserUseCase(lateFailure(failure), users).save(makeUser("alice"))).rejects.toBe(failure);
    expect(users.users.size).toBe(0);
  });

  it("saves categories through the scope and rolls back failed updates", async () => {
    const category = new Category({ categoryId: "cat", name: "Original" });
    const useCase = new CategoryUseCase(unitOfWork, readProvider(categories));
    expect(await useCase.save(category)).toBe(category);
    expect(await useCase.fetchCategoryById("cat")).toBe(category);
    const failure = new Error("commit failed");
    await expect(new CategoryUseCase(lateFailure(failure), categories).save(
      new Category({ categoryId: "cat", name: "Changed" }),
    )).rejects.toBe(failure);
    expect(categories.fetchCategoryById("cat")).toBe(category);
  });

  it("saves cart items through the scope and rolls back failed updates", async () => {
    const item = new CartItem({ itemId: "line", cartId: "cart", productId: "product", quantity: 1 });
    const useCase = new CartItemUseCase(unitOfWork, readProvider(cartItems));
    expect(await useCase.save(item)).toBe(item);
    expect(await useCase.fetchCartItemByItemId("line")).toBe(item);
    const failure = new Error("commit failed");
    await expect(new CartItemUseCase(lateFailure(failure), cartItems).save(item.withQuantity(2))).rejects.toBe(failure);
    expect(cartItems.fetchCartItemByItemId("line")).toBe(item);
  });

  it("uses the supplied payment transaction scope and propagates its commit failure", async () => {
    const transaction = new Transaction({ transactionId: "payment", orderId: "order", amount: 100, status: "pending", method: "cash" });
    const failure = new Error("commit failed");
    const scoped = {
      save: vi.fn(async () => transaction),
      fetchTransactionsByOrderId: vi.fn(async () => [transaction]),
      fetchTransactionById: vi.fn(async () => transaction),
    };
    const execute = vi.fn(async (work) => {
      await work({ transactions: scoped });
      throw failure;
    });
    const useCase = new TransactionUseCase({ execute }, readProvider(scoped));
    await expect(useCase.save(transaction)).rejects.toBe(failure);
    expect(scoped.save).toHaveBeenCalledWith(transaction);
    expect(await useCase.fetchTransactionById("payment")).toBe(transaction);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
