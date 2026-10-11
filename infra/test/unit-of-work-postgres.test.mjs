import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { DataSource } from "typeorm";
import { CartUseCase, OrderUseCase, UserUseCase } from "@shopeer/case";
import { CartChangedError, OutOfStockError } from "@shopeer/domain";
import { TypeOrmUnitOfWork } from "../dist/database/TypeOrmUnitOfWork.js";
import { CartEntity } from "../dist/nest/modules/cart/Cart.repository.js";
import { CartItemEntity } from "../dist/nest/modules/cart/CartItem.repository.js";
import { ProductEntity } from "../dist/nest/modules/product/Product.repository.js";
import { CategoryEntity } from "../dist/nest/modules/product/Category.repository.js";
import { UserEntity, TypeOrmUserRepository } from "../dist/nest/modules/user/User.repository.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "../dist/nest/modules/order/Order.repository.js";
import { Init1789712564933 } from "../dist/nest/modules/app/migrations/1789712564933-init.js";
import { CartAndOrder1790475374461 } from "../dist/nest/modules/app/migrations/1790475374461-cart-and-order.js";
import { OrderCartId1791680000000 } from "../dist/nest/modules/app/migrations/1791680000000-order-cart-id.js";

// Explicit opt-in. Each run owns a unique schema; existing tables are untouched.
const databaseUrl = process.env.UOW_TEST_DATABASE_URL;
describe("Unit of Work with PostgreSQL", {
  skip: databaseUrl ? false : "Set UOW_TEST_DATABASE_URL to run real database checks",
  timeout: 30_000,
}, () => {
  const schema = `uow_test_${randomUUID().replaceAll("-", "")}`;
  let admin;
  let database;
  let unitOfWork;
  let orderRepository;
  const ids = { generate: () => randomUUID() };
  const checkout = (work = unitOfWork) => new OrderUseCase(work, orderRepository, ids);

  before(async () => {
    admin = new DataSource({ type: "postgres", url: databaseUrl });
    await admin.initialize();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    database = new DataSource({
      type: "postgres", url: databaseUrl, schema,
      extra: { options: `-c search_path=${schema},public`, max: 8 },
      entities: [CartEntity, CartItemEntity, ProductEntity, CategoryEntity, UserEntity, OrderEntity, OrderItemEntity],
      migrations: [Init1789712564933, CartAndOrder1790475374461, OrderCartId1791680000000],
    });
    await database.initialize();
    await database.runMigrations();
    unitOfWork = new TypeOrmUnitOfWork(database);
    orderRepository = new TypeOrmOrderRepository(
      database.getRepository(OrderEntity), database.getRepository(OrderItemEntity),
    );
  });

  after(async () => {
    if (database?.isInitialized) await database.destroy();
    if (admin?.isInitialized) {
      try { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); }
      finally { await admin.destroy(); }
    }
  });

  beforeEach(async () => {
    await database.query(`TRUNCATE "order_items", "orders", "cart_items", "carts", "products", "categories", "users" CASCADE`);
    await database.query(`INSERT INTO "users" ("id", "username", "hashed_password", "created_at", "suspended")
      VALUES ('alice', 'alice', 'hash', now(), false), ('bob', 'bob', 'hash', now(), false)`);
    await database.query(`INSERT INTO "categories" ("id", "name") VALUES ('cat', 'Category')`);
    await database.query(`INSERT INTO "products" ("id", "name", "description", "price", "category_id", "stock", "image_url")
      VALUES ('a-plenty', 'Plenty', 'Product', 100, 'cat', 10, 'image'),
             ('z-last', 'Last', 'Product', 200, 'cat', 1, 'image')`);
    await database.query(`INSERT INTO "carts" ("id", "user_id") VALUES ('cart-alice', 'alice'), ('cart-bob', 'bob')`);
    await database.query(`INSERT INTO "cart_items" ("id", "cart_id", "product_id", "quantity") VALUES
      ('alice-plenty', 'cart-alice', 'a-plenty', 1), ('alice-last', 'cart-alice', 'z-last', 1),
      ('bob-last', 'cart-bob', 'z-last', 1), ('bob-plenty', 'cart-bob', 'a-plenty', 1)`);
  });

  async function stocks() {
    const products = await database.getRepository(ProductEntity).find({ order: { id: "ASC" } });
    return products.map((product) => product.stock);
  }

  it("commits the order, stock and cart together and reloads its cartId", async () => {
    const order = await checkout().checkout("alice");
    const stored = await orderRepository.fetchOrderById(order.orderId);
    assert.equal(stored.cartId, "cart-alice");
    assert.equal(stored.items.length, 2);
    assert.equal(stored.totalAmount, 300);
    assert.deepEqual(await stocks(), [9, 0]);
    assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 0);
  });

  it("adds, edits, removes and clears cart lines through the Unit of Work", async () => {
    const cart = new CartUseCase(unitOfWork, ids);
    await cart.addItem("alice", "a-plenty", 2);
    assert.equal((await cart.getCart("alice")).lines.find((line) => line.product.productId === "a-plenty").item.quantity, 3);
    await cart.updateItemQuantity("alice", "a-plenty", 4);
    await cart.removeItem("alice", "z-last");
    assert.equal((await cart.getCart("alice")).lines[0].item.quantity, 4);
    await cart.clearCart("alice");
    assert.equal((await cart.getCart("alice")).lines.length, 0);
    assert.deepEqual(await stocks(), [10, 1]);
  });

  it("rolls back user creation and category/product writes as one operation", async () => {
    const failure = new Error("late failure");
    const before = await database.getRepository(UserEntity).count();
    const { User, Category, Product } = await import("@shopeer/domain");
    await assert.rejects(unitOfWork.execute(async ({ users, categories, products }) => {
      await users.save(new User({ id: "new-user", username: "newuser", hashedPassword: "hash", suspended: false }));
      await categories.save(new Category({ categoryId: "new-cat", name: "New category" }));
      await products.save(new Product({ productId: "new-product", name: "Product", description: "Product", categoryId: "new-cat", price: 100, stock: 1, imageUrl: "image" }));
      throw failure;
    }), (error) => error === failure);
    assert.equal(await database.getRepository(UserEntity).count(), before);
    assert.equal(await database.getRepository(CategoryEntity).countBy({ id: "new-cat" }), 0);
    assert.equal(await database.getRepository(ProductEntity).countBy({ id: "new-product" }), 0);
  });

  it("saves a user through the application write path", async () => {
    const { User } = await import("@shopeer/domain");
    const users = new UserUseCase(unitOfWork, new TypeOrmUserRepository(database.getRepository(UserEntity)));
    const user = await users.save(new User({ id: "new-user", username: "newuser", hashedPassword: "hash", suspended: false }));
    assert.equal((await users.fetchUserById(user.id)).username, "newuser");
    const cart = new CartUseCase(unitOfWork, ids);
    const view = await cart.getCart(user.id);
    assert.equal(view.cart.userId, user.id);
    assert.equal(await database.getRepository(CartEntity).countBy({ userId: user.id }), 1);
  });

  it("rolls back changes made through multiple repositories on a late failure", async () => {
    const failure = new Error("failed after writing order");
    const failingWork = {
      execute: (work) => unitOfWork.execute(async (repositories) => {
        await repositories.cartItems.deleteCartItemsByCartId("cart-bob");
        await work(repositories);
        throw failure;
      }),
    };
    await assert.rejects(checkout(failingWork).checkout("alice"), (error) => error === failure);
    assert.deepEqual(await stocks(), [10, 1]);
    assert.equal(await database.getRepository(OrderEntity).count(), 0);
    assert.equal(await database.getRepository(OrderItemEntity).count(), 0);
    assert.equal(await database.getRepository(CartItemEntity).count(), 4);
  });

  it("rejects a changed ordered quantity and preserves the other transaction's edit", async () => {
    const editingWork = {
      execute: (work) => unitOfWork.execute(async (repositories) => {
        const fetch = repositories.products.fetchProductsByIds.bind(repositories.products);
        repositories.products.fetchProductsByIds = async (ids) => {
          const products = await fetch(ids);
          await database.getRepository(CartItemEntity).update({ id: "alice-plenty" }, { quantity: 2 });
          return products;
        };
        return work(repositories);
      }),
    };
    await assert.rejects(checkout(editingWork).checkout("alice"), CartChangedError);
    assert.deepEqual(await stocks(), [10, 1]);
    assert.equal(await database.getRepository(OrderEntity).count(), 0);
    const edited = await database.getRepository(CartItemEntity).findOneByOrFail({ id: "alice-plenty" });
    assert.equal(edited.quantity, 2);
  });

  it("sells the last unit once and rolls back the losing buyer's other stock updates", async () => {
    let arrived = 0;
    let release;
    const bothHaveRead = new Promise((resolve) => { release = resolve; });
    const competingWork = {
      execute: (work) => unitOfWork.execute(async (repositories) => {
        const fetch = repositories.products.fetchProductsByIds.bind(repositories.products);
        repositories.products.fetchProductsByIds = async (ids) => {
          const products = await fetch(ids);
          if (++arrived === 2) release();
          await bothHaveRead;
          return products;
        };
        return work(repositories);
      }),
    };
    const useCase = checkout(competingWork);
    const results = await Promise.allSettled([useCase.checkout("alice"), useCase.checkout("bob")]);
    assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
    const loser = results.find((result) => result.status === "rejected");
    assert.ok(loser.reason instanceof OutOfStockError);
    assert.deepEqual(loser.reason.productIds, ["z-last"]);
    assert.deepEqual(await stocks(), [9, 0]);
    assert.equal(await database.getRepository(OrderEntity).count(), 1);
    assert.equal(await database.getRepository(OrderItemEntity).count(), 2);
    assert.equal(await database.getRepository(CartItemEntity).count(), 2);
  });

  it("backfills an existing order's cartId when upgrading the schema", async () => {
    const migration = new OrderCartId1791680000000();
    await database.transaction(async (manager) => {
      const runner = manager.queryRunner;
      await migration.down(runner);
      await manager.query(`INSERT INTO "orders" ("id", "user_id", "total_amount") VALUES ('old-order', 'alice', 100)`);
      await migration.up(runner);
    });
    const order = await database.getRepository(OrderEntity).findOneByOrFail({ id: "old-order" });
    assert.equal(order.cartId, "cart-alice");
  });
});
