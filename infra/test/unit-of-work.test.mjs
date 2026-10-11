import "reflect-metadata";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DataSource, EntityManager } from "typeorm";
import { TypeOrmUnitOfWork } from "../dist/database/TypeOrmUnitOfWork.js";
import { TransactionRequiredError } from "../dist/database/requireTransaction.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "../dist/nest/modules/order/Order.repository.js";
import { CartEntity, TypeOrmCartRepository } from "../dist/nest/modules/cart/Cart.repository.js";
import { CartItemEntity, TypeOrmCartItemRepository } from "../dist/nest/modules/cart/CartItem.repository.js";
import { ProductEntity, TypeOrmProductRepository } from "../dist/nest/modules/product/Product.repository.js";
import { CategoryEntity, TypeOrmCategoryRepository } from "../dist/nest/modules/product/Category.repository.js";
import { UserEntity, TypeOrmUserRepository } from "../dist/nest/modules/user/User.repository.js";

// Use TypeORM's real transaction orchestration with a controlled connection.
function connection({ commitError } = {}) {
  const dataSource = new DataSource({ type: "postgres" });
  const runners = [];
  dataSource.createQueryRunner = () => {
    const events = [];
    const runner = {
      isTransactionActive: false,
      isReleased: false,
      async startTransaction() { this.isTransactionActive = true; events.push("begin"); },
      async commitTransaction() {
        events.push("commit");
        if (commitError) throw commitError;
        this.isTransactionActive = false;
      },
      async rollbackTransaction() { this.isTransactionActive = false; events.push("rollback"); },
      async release() { this.isReleased = true; events.push("release"); },
      async query() {
        events.push("query");
        return [{ id: "line", cart_id: "cart", product_id: "product", quantity: 1 }];
      },
    };
    runner.manager = new EntityManager(dataSource, runner);
    runners.push({ runner, events });
    return runner;
  };
  return { unitOfWork: new TypeOrmUnitOfWork(dataSource), dataSource, runners };
}

describe("TypeOrmUnitOfWork", () => {
  it("binds every adapter and raw SQL to one manager and resolves after commit", async () => {
    const { unitOfWork, runners } = connection();
    const result = await unitOfWork.execute(async (repositories) => {
      const manager = runners[0].runner.manager;
      assert.equal(repositories.carts.cartRepository.manager, manager);
      assert.equal(repositories.cartItems.cartItemRepository.manager, manager);
      assert.equal(repositories.products.productRepository.manager, manager);
      assert.equal(repositories.users.userRepository.manager, manager);
      assert.equal(repositories.categories.categoryRepository.manager, manager);
      assert.equal(repositories.orders.orderRepository.manager, manager);
      assert.equal(repositories.orders.orderItemRepository.manager, manager);
      const line = await repositories.cartItems.addOrIncreaseQuantity({
        itemId: "line", cartId: "cart", productId: "product", quantity: 1,
      });
      assert.equal(line.quantity, 1);
      assert.deepEqual(runners[0].events, ["begin", "query"]);
      return "order";
    });
    assert.equal(result, "order");
    assert.deepEqual(runners[0].events, ["begin", "query", "commit", "release"]);
  });

  it("rolls back and preserves the callback error", async () => {
    const { unitOfWork, runners } = connection();
    const failure = new Error("persistence failed");
    await assert.rejects(unitOfWork.execute(async () => { throw failure; }), (error) => error === failure);
    assert.deepEqual(runners[0].events, ["begin", "rollback", "release"]);
  });

  it("does not return a successful result when commit fails", async () => {
    const failure = new Error("commit failed");
    const { unitOfWork, runners } = connection({ commitError: failure });
    await assert.rejects(unitOfWork.execute(async () => "order"), (error) => error === failure);
    assert.deepEqual(runners[0].events, ["begin", "commit", "rollback", "release"]);
  });

  it("creates independent adapters and managers for concurrent executions", async () => {
    const { unitOfWork, runners } = connection();
    const scopes = await Promise.all([
      unitOfWork.execute(async (repositories) => repositories),
      unitOfWork.execute(async (repositories) => repositories),
    ]);
    assert.equal(runners.length, 2);
    assert.notEqual(scopes[0].orders, scopes[1].orders);
    assert.notEqual(scopes[0].orders.orderRepository.manager, scopes[1].orders.orderRepository.manager);
    for (const { events } of runners) assert.deepEqual(events, ["begin", "commit", "release"]);
  });

  it("rejects placeOrder outside a transaction before changing data", async () => {
    const { dataSource, runners } = connection();
    const orders = new TypeOrmOrderRepository(
      dataSource.getRepository(OrderEntity), dataSource.getRepository(OrderItemEntity),
    );
    await assert.rejects(orders.placeOrder({}, "cart"), TransactionRequiredError);
    assert.equal(runners.length, 0);
  });

  for (const [name, Entity, Adapter, method, args] of [
    ["cart save", CartEntity, TypeOrmCartRepository, "save", [{}]],
    ["cart creation", CartEntity, TypeOrmCartRepository, "insertIfAbsent", [{}]],
    ["cart item save", CartItemEntity, TypeOrmCartItemRepository, "save", [{}]],
    ["cart item upsert", CartItemEntity, TypeOrmCartItemRepository, "addOrIncreaseQuantity", [{}]],
    ["cart item deletion", CartItemEntity, TypeOrmCartItemRepository, "deleteCartItem", ["cart", "product"]],
    ["cart clearing", CartItemEntity, TypeOrmCartItemRepository, "deleteCartItemsByCartId", ["cart"]],
    ["product save", ProductEntity, TypeOrmProductRepository, "save", [{}]],
    ["category save", CategoryEntity, TypeOrmCategoryRepository, "save", [{}]],
    ["user save", UserEntity, TypeOrmUserRepository, "save", [{}]],
  ]) {
    it(`rejects ${name} through a normal repository provider`, async () => {
      const { dataSource, runners } = connection();
      const repository = new Adapter(dataSource.getRepository(Entity));
      await assert.rejects(repository[method](...args), TransactionRequiredError);
      assert.equal(runners.length, 0);
    });
  }

  it("rejects writes with a repository retained after its transaction ends", async () => {
    const { unitOfWork } = connection();
    let items;
    await unitOfWork.execute(async (repositories) => { items = repositories.cartItems; });
    await assert.rejects(items.deleteCartItemsByCartId("cart"), TransactionRequiredError);
  });
});
