import "reflect-metadata";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, beforeEach, describe, it } from "node:test";
import { DataSource } from "typeorm";
import { Test } from "@nestjs/testing";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import request from "supertest";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { DomainErrorFilter } from "../dist/nest/common/filters/DomainError.filter.js";
import { SalesUseCase, CartUseCase, OrderUseCase, UserUseCase } from "@shopeer/case";
import { CartChangedError, EmptyCartError, NotFoundError, OutOfStockError, Permission, Role } from "@shopeer/domain";
import { TypeOrmUnitOfWork } from "../dist/database/TypeOrmUnitOfWork.js";
import { CartEntity } from "../dist/nest/modules/cart/Cart.repository.js";
import { CartItemEntity } from "../dist/nest/modules/cart/CartItem.repository.js";
import { ProductEntity } from "../dist/nest/modules/product/Product.repository.js";
import { CategoryEntity } from "../dist/nest/modules/product/Category.repository.js";
import { UserEntity, TypeOrmUserRepository } from "../dist/nest/modules/user/User.repository.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "../dist/nest/modules/order/Order.repository.js";
import { RoleEntity, TypeOrmRoleRepository } from "../dist/nest/modules/role/Role.repository.js";
import { Init1789712564933 } from "../dist/nest/modules/app/migrations/1789712564933-init.js";
import { CartAndOrder1790475374461 } from "../dist/nest/modules/app/migrations/1790475374461-cart-and-order.js";
import { OrderCartId1791680000000 } from "../dist/nest/modules/app/migrations/1791680000000-order-cart-id.js";
import { Roles1791786448696 } from "../dist/nest/modules/app/migrations/1791786448696-roles.js";
import { OrderStatus1794000000000 } from "../dist/nest/modules/app/migrations/1794000000000-order-status.js";
import { OrderDelivered1794200000000 } from "../dist/nest/modules/app/migrations/1794200000000-order-delivered.js";
import { OrderSellers1794050000000 } from "../dist/nest/modules/app/migrations/1794050000000-order-sellers.js";

import { SalesPeriods1794100000000 } from "../dist/nest/modules/app/migrations/1794100000000-sales-periods.js";
import { SalesPeriodEntity } from "../dist/nest/modules/product/Sales.repository.js";

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
      entities: [SalesPeriodEntity, CartEntity, CartItemEntity, ProductEntity, CategoryEntity, UserEntity, OrderEntity, OrderItemEntity, RoleEntity],
      migrations: [Init1789712564933, CartAndOrder1790475374461, OrderCartId1791680000000, Roles1791786448696, OrderStatus1794000000000, OrderSellers1794050000000, SalesPeriods1794100000000, OrderDelivered1794200000000],
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

  const sales = () => new SalesUseCase(unitOfWork, ids);
  it("persists the two-step completion protocol under duplicate confirmations", async () => {
    const useCase = checkout();
    const placed = await useCase.checkout("alice");
    await assert.rejects(useCase.confirmReceipt("alice", placed.orderId), /handler must confirm delivery/);
    await Promise.all([useCase.confirmDelivery(placed.orderId), useCase.confirmDelivery(placed.orderId)]);
    assert.equal((await useCase.getOrder("alice", placed.orderId)).status, "delivered");
    assert.deepEqual((await useCase.listHandlerOrders({ page: 1, limit: 20 }, "delivered")).map(order => order.orderId), [placed.orderId]);
    assert.deepEqual(await useCase.listHandlerOrders({ page: 1, limit: 20 }, "pending"), []);
    assert.equal((await useCase.getHandlerOrder(placed.orderId)).items.length, placed.items.length);
    await assert.rejects(useCase.confirmReceipt("bob", placed.orderId), NotFoundError);
    await Promise.all([useCase.confirmReceipt("alice", placed.orderId), useCase.confirmReceipt("alice", placed.orderId)]);
    assert.equal((await useCase.confirmDelivery(placed.orderId)).status, "completed");
    assert.equal(await unitOfWork.execute(({ orders }) => orders.transitionStatus(placed.orderId, "pending", "delivered")), false);
    assert.equal((await useCase.getOrder("alice", placed.orderId)).status, "completed");
  });
  const future = () => new Date(Date.now() + 3_600_000);
  const productInput = { name: "Seller mug", description: "Ceramic mug", price: 100, categoryId: "cat", stock: 3, imageUrl: "https://example.com/mug.jpg" };

  it("publishes a product owned by the seller and reserves only its period's stock", async () => {
    const period = await sales().create("alice", productInput, future());
    assert.equal(period.quantity, 3);
    await new CartUseCase(unitOfWork, ids).addItem("bob", period.productId, 2);
    const order = await checkout().checkout("bob");
    assert.equal(order.items.find(item => item.productId === period.productId).saleId, period.id);
    const stored = await database.getRepository(SalesPeriodEntity).findOneByOrFail({ id: period.id });
    assert.equal(stored.quantity, 3); assert.equal(stored.remaining, 1);
    assert.equal((await sales().list("alice", { page: 1, limit: 20 }))[0].stock, 1);
    assert.deepEqual(await sales().list("bob", { page: 1, limit: 20 }), []);
  });

  it("prevents another seller from publishing and prevents editing published stock or ownership", async () => {
    const period = await sales().create("alice", productInput, future());
    await assert.rejects(sales().publish("bob", period.productId, 5, future()), NotFoundError);
    await assert.rejects(sales().publish("alice", period.productId, 5, future()), /has not ended/);
    await assert.rejects(unitOfWork.execute(async ({ products }) => products.save(await products.fetchProductById(period.productId))), /cannot be edited/);
    await assert.rejects(unitOfWork.execute(({ products }) => products.assignSeller(period.productId, "bob")), /cannot be reassigned/);
    await assert.rejects(database.query(`UPDATE "sales_periods" SET quantity = quantity + 1 WHERE id = $1`, [period.id]), /immutable/);
    assert.equal(await database.getRepository(SalesPeriodEntity).count(), 1);
  });

  it("sells a period's final unit only once and permits added stock after sellout", async () => {
    await database.query(`DELETE FROM cart_items`);
    const period = await sales().create("alice", { ...productInput, stock: 1 }, future());
    const carts = new CartUseCase(unitOfWork, ids);
    await carts.addItem("alice", period.productId, 1);
    await carts.addItem("bob", period.productId, 1);
    const results = await Promise.allSettled([checkout().checkout("alice"), checkout().checkout("bob")]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    assert.equal((await database.getRepository(SalesPeriodEntity).findOneByOrFail({ id: period.id })).remaining, 0);
    const next = await sales().publish("alice", period.productId, 4, future());
    assert.equal(next.quantity, 4);
    assert.equal(await database.getRepository(OrderEntity).count(), 1);
  });

  async function expiredPeriod() {
    await database.query(`UPDATE products SET seller_id = 'alice' WHERE id = 'a-plenty'`);
    await database.query(`INSERT INTO sales_periods (id, product_id, quantity, remaining, additional_stock, starts_at, ends_at) VALUES ('expired', 'a-plenty', 12, 10, 0, now() - interval '2 days', now() - interval '1 day')`);
    await database.query(`UPDATE products SET sale_id = 'expired', sale_ends_at = now() - interval '1 day' WHERE id = 'a-plenty'`);
  }

  it("carries leftovers plus additional stock into one new period under concurrent publishing", async () => {
    await expiredPeriod();
    const results = await Promise.allSettled([sales().publish("alice", "a-plenty", 5, future()), sales().publish("alice", "a-plenty", 5, future())]);
    assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
    const periods = await database.getRepository(SalesPeriodEntity).find({ order: { startsAt: "ASC" } });
    assert.deepEqual(periods.map(p => [p.quantity, p.remaining]), [[12, 10], [15, 15]]);
    assert.equal((await database.getRepository(ProductEntity).findOneByOrFail({ id: "a-plenty" })).stock, 15);
  });

  it("does not sell expired stock and can republish leftovers with zero additional units", async () => {
    await expiredPeriod();
    await assert.rejects(checkout().checkout("bob"), OutOfStockError);
    assert.equal(await database.getRepository(OrderEntity).count(), 0);
    assert.equal((await sales().publish("alice", "a-plenty", 0, future())).quantity, 10);
    await checkout().checkout("bob");
  });

  it("rejects a stale checkout snapshot when its product enters a new period", async () => {
    await database.query(`UPDATE products SET seller_id = 'alice' WHERE id = 'a-plenty'`);
    const work = { execute: operation => unitOfWork.execute(async repositories => {
      const fetch = repositories.products.fetchProductsByIds.bind(repositories.products);
      repositories.products.fetchProductsByIds = async ids => {
        const products = await fetch(ids);
        await sales().publish("alice", "a-plenty", 5, future());
        return products;
      };
      return operation(repositories);
    }) };
    await assert.rejects(checkout(work).checkout("bob"), OutOfStockError);
    assert.equal(await database.getRepository(OrderEntity).count(), 0);
    assert.equal((await database.getRepository(SalesPeriodEntity).findOneByOrFail({ productId: "a-plenty" })).remaining, 15);
  });

  it("rolls back product creation when publication fails and rejects invalid stock and dates", async () => {
    await assert.rejects(sales().create("alice", { ...productInput, categoryId: "missing" }, future()), NotFoundError);
    await assert.rejects(sales().create("alice", { ...productInput, stock: 0 }, future()));
    await assert.rejects(sales().publish("alice", "a-plenty", -1, future()));
    await assert.rejects(sales().publish("alice", "a-plenty", 1, new Date(0)));
    assert.equal(await database.getRepository(SalesPeriodEntity).count(), 0);
    assert.equal(await database.getRepository(ProductEntity).count(), 2);
  });

  async function stocks() {
    const products = await database.getRepository(ProductEntity).find({ order: { id: "ASC" } });
    return products.map((product) => product.stock);
  }

  it("keeps seller projections private and snapshots ownership and product identity", async () => {
    await database.query(`INSERT INTO "users" ("id", "username", "hashed_password", "created_at", "suspended") VALUES ('seller-a', 'sellera', 'hash', now(), false), ('seller-b', 'sellerb', 'hash', now(), false)`);
    assert.equal((await database.getRepository(ProductEntity).findOneByOrFail({ id: "a-plenty" })).sellerId, null);
    await database.getRepository(ProductEntity).update({ id: "a-plenty" }, { sellerId: "seller-a" });
    await database.getRepository(ProductEntity).update({ id: "z-last" }, { sellerId: "seller-b" });
    const order = await checkout().checkout("alice");
    const a = await orderRepository.fetchOrderBySellerId("seller-a", order.orderId);
    const b = await orderRepository.fetchOrderBySellerId("seller-b", order.orderId);
    assert.deepEqual(a.items.map((item) => item.productId), ["a-plenty"]);
    assert.deepEqual(b.items.map((item) => item.productId), ["z-last"]);
    assert.equal(a.totalAmount, 100); assert.equal(b.totalAmount, 200);
    assert.equal((await orderRepository.fetchOrdersBySellerId("seller-a", { page: 1, limit: 20 }))[0].totalAmount, 100);
    assert.deepEqual(await orderRepository.fetchOrdersBySellerId("alice", { page: 1, limit: 20 }), []);
    await database.getRepository(ProductEntity).update({ id: "a-plenty" }, { sellerId: "seller-b", name: "Changed", price: 999 });
    assert.equal((await orderRepository.fetchOrderBySellerId("seller-a", order.orderId)).items[0].name, "Plenty");
    assert.deepEqual((await orderRepository.fetchOrderBySellerId("seller-b", order.orderId)).items.map((item) => item.productId), ["z-last"]);
    assert.equal((await orderRepository.fetchOrderById(order.orderId)).totalAmount, 300);
  });

  it("rolls checkout back if a product seller changes after its snapshot is read", async () => {
    const work = { execute: (operation) => unitOfWork.execute(async (repositories) => {
      const fetch = repositories.products.fetchProductsByIds.bind(repositories.products);
      repositories.products.fetchProductsByIds = async (ids) => {
        const result = await fetch(ids);
        await database.getRepository(ProductEntity).update({ id: "a-plenty" }, { sellerId: "bob" });
        return result;
      };
      return operation(repositories);
    }) };
    await assert.rejects(checkout(work).checkout("alice"), OutOfStockError);
    assert.equal(await database.getRepository(OrderEntity).count(), 0);
    assert.deepEqual(await stocks(), [10, 1]);
    assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 2);
  });

  it("does not grant seller access to an unassigned order after later product assignment", async () => {
    const order = await checkout().checkout("alice");
    await database.getRepository(ProductEntity).update({ id: "a-plenty" }, { sellerId: "bob" });
    assert.equal(await orderRepository.fetchOrderBySellerId("bob", order.orderId), null);
    assert.deepEqual(await orderRepository.fetchOrdersBySellerId("bob", { page: 1, limit: 20 }), []);
  });

  it("migrates historical products and orders without inventing seller ownership", async () => {
    const order = await checkout().checkout("alice");
    const runner = database.createQueryRunner();
    await runner.connect(); await runner.startTransaction();
    try {
      const migration = new OrderSellers1794050000000();
      await migration.down(runner); await migration.up(runner);
      const rows = await runner.query(`SELECT "seller_id", "product_name" FROM "order_items" WHERE "order_id" = $1 ORDER BY "product_id"`, [order.orderId]);
      assert.deepEqual(rows.map((row) => row.seller_id), [null, null]);
      assert.deepEqual(rows.map((row) => row.product_name), ["Plenty", "Last"]);
      assert.ok((await runner.query(`SELECT "seller_id" FROM "products"`)).every((row) => row.seller_id === null));
    } finally { await runner.rollbackTransaction(); await runner.release(); }
  });

  // Hold one operation after it owns the parent lock. Confirm PostgreSQL has
  // actually blocked the other operation before releasing it (no timing guess).
  async function raceSameCart(firstOperation, secondOperation) {
    const deferred = () => {
      let resolve;
      const promise = new Promise((done) => { resolve = done; });
      return { promise, resolve };
    };
    const held = deferred(), release = deferred(), waiting = deferred();
    const wrap = (hold) => ({
      execute: (work) => unitOfWork.execute(async (repositories) => {
        const lock = repositories.carts.lockCart.bind(repositories.carts);
        repositories.carts.lockCart = async (cartId) => {
          if (!hold) {
            const [{ pid }] = await repositories.carts.cartRepository.manager.query(`SELECT pg_backend_pid() AS pid`);
            waiting.resolve(pid);
          }
          await lock(cartId);
          if (hold) { held.resolve(); await release.promise; }
        };
        return work(repositories);
      }),
    });
    const first = firstOperation(wrap(true));
    // Surface an early failure instead of waiting forever for the lock hook.
    await Promise.race([held.promise, first.then(() => { throw new Error("First operation did not lock the cart"); })]);
    const second = secondOperation(wrap(false));
    let failure;
    try {
      const pid = await Promise.race([waiting.promise, second.then(() => { throw new Error("Second operation did not lock the cart"); })]);
      const deadline = Date.now() + 5_000;
      while (true) {
        const [{ blocked }] = await database.query(`SELECT cardinality(pg_blocking_pids($1::int)) > 0 AS blocked`, [pid]);
        if (blocked) break;
        assert.ok(Date.now() < deadline, "The second operation must wait for the parent cart lock");
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch (error) { failure = error; }
    finally { release.resolve(); }
    const results = await Promise.allSettled([first, second]);
    if (failure) throw failure;
    return results;
  }

  for (const [name, mutate, afterCheckoutError, remainingQuantity, purchasedQuantity] of [
    ["quantity edit", (cart) => cart.updateItemQuantity("alice", "a-plenty", 2), CartChangedError, 0, 2],
    ["addition", (cart) => cart.addItem("alice", "a-plenty", 1), null, 1, 2],
    ["removal", (cart) => cart.removeItem("alice", "a-plenty"), NotFoundError, 0, 0],
    ["clear", (cart) => cart.clearCart("alice"), null, 0, null],
  ]) {
    it(`serializes checkout before a concurrent ${name}`, async () => {
      const [purchase, edit] = await raceSameCart(
        (work) => checkout(work).checkout("alice"),
        (work) => mutate(new CartUseCase(work, ids)),
      );
      assert.equal(purchase.status, "fulfilled");
      assert.equal(purchase.value.items.find((item) => item.productId === "a-plenty").quantity, 1);
      if (afterCheckoutError) assert.ok(edit.reason instanceof afterCheckoutError);
      else assert.equal(edit.status, "fulfilled");
      const lines = await database.getRepository(CartItemEntity).findBy({ cartId: "cart-alice" });
      assert.equal(lines.reduce((sum, line) => sum + line.quantity, 0), remainingQuantity);
      assert.deepEqual(await stocks(), [9, 0]);
      assert.equal(await database.getRepository(OrderEntity).count(), 1);
    });

    it(`serializes a ${name} before concurrent checkout`, async () => {
      const [edit, purchase] = await raceSameCart(
        (work) => mutate(new CartUseCase(work, ids)),
        (work) => checkout(work).checkout("alice"),
      );
      assert.equal(edit.status, "fulfilled");
      if (purchasedQuantity === null) {
        assert.ok(purchase.reason instanceof EmptyCartError);
        assert.equal(await database.getRepository(OrderEntity).count(), 0);
        assert.deepEqual(await stocks(), [10, 1]);
      } else {
        assert.equal(purchase.status, "fulfilled");
        const product = purchase.value.items.find((item) => item.productId === "a-plenty");
        assert.equal(product?.quantity ?? 0, purchasedQuantity);
        assert.deepEqual(await stocks(), [10 - purchasedQuantity, 0]);
      }
      assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 0);
    });
  }

  it("allows only one of two simultaneous checkouts of the same cart", async () => {
    const [first, second] = await raceSameCart(
      (work) => checkout(work).checkout("alice"), (work) => checkout(work).checkout("alice"),
    );
    assert.equal(first.status, "fulfilled");
    assert.ok(second.reason instanceof EmptyCartError);
    assert.equal(await database.getRepository(OrderEntity).count(), 1);
    assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 0);
    assert.deepEqual(await stocks(), [9, 0]);
  });

  it("never inserts a removed line or edits its replacement through a stale quantity update", async () => {
    const stale = await unitOfWork.execute(async ({ carts, cartItems }) => {
      await carts.lockCart("cart-alice");
      return cartItems.fetchCartItem("cart-alice", "a-plenty");
    });
    await checkout().checkout("alice");
    const staleUpdate = () => unitOfWork.execute(async ({ carts, cartItems }) => {
      await carts.lockCart("cart-alice");
      return cartItems.updateQuantity(stale.withQuantity(5));
    });
    assert.equal(await staleUpdate(), false);
    assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 0);
    await new CartUseCase(unitOfWork, ids).addItem("alice", "a-plenty", 2);
    assert.equal(await staleUpdate(), false);
    const replacement = await database.getRepository(CartItemEntity).findOneByOrFail({ cartId: "cart-alice", productId: "a-plenty" });
    assert.equal(replacement.quantity, 2);
    assert.notEqual(replacement.id, stale.itemId);
  });

  it("commits the order, stock and cart together and reloads its cartId", async () => {
    const order = await checkout().checkout("alice");
    const stored = await orderRepository.fetchOrderById(order.orderId);
    assert.equal(stored.cartId, "cart-alice");
    assert.equal(stored.items.length, 2);
    assert.equal(stored.totalAmount, 300);
    assert.equal(order.status, "pending");
    assert.equal(stored.status, order.status);
    assert.equal((await orderRepository.fetchOrdersByUserId("alice", { page: 1, limit: 20 }))[0].status, order.status);
    assert.deepEqual(await stocks(), [9, 0]);
    assert.equal(await database.getRepository(CartItemEntity).countBy({ cartId: "cart-alice" }), 0);
  });

  it("preserves persisted completed and cancelled states on order reads", async () => {
    const order = await checkout().checkout("alice");
    for (const status of ["completed", "cancelled"]) {
      await database.getRepository(OrderEntity).update({ id: order.orderId }, { status });
      assert.equal((await orderRepository.fetchOrderById(order.orderId)).status, status);
      assert.equal((await orderRepository.fetchOrdersByUserId("alice", { page: 1, limit: 20 }))[0].status, status);
    }
    await assert.rejects(database.getRepository(OrderEntity).update({ id: order.orderId }, { status: "invalid" }),
      (error) => error.driverError?.code === "23514");
  });

  it("migrates historical orders as completed and defaults new rows to pending", async () => {
    const runner = database.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const migration = new OrderStatus1794000000000();
      await migration.down(runner);
      await runner.query(`INSERT INTO "orders" ("id", "user_id", "cart_id", "total_amount") VALUES ('historical', 'alice', 'cart-alice', 100)`);
      await migration.up(runner);
      assert.equal((await runner.query(`SELECT "status" FROM "orders" WHERE "id" = 'historical'`))[0].status, "completed");
      await runner.query(`INSERT INTO "orders" ("id", "user_id", "cart_id", "total_amount") VALUES ('new-default', 'alice', 'cart-alice', 100)`);
      assert.equal((await runner.query(`SELECT "status" FROM "orders" WHERE "id" = 'new-default'`))[0].status, "pending");
    } finally {
      await runner.rollbackTransaction();
      await runner.release();
    }
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

  it("registers a username once when concurrent HTTP requests both read it as available", async () => {
    const repository = new TypeOrmUserRepository(database.getRepository(UserEntity));
    const users = new UserUseCase(unitOfWork, repository);
    const fetch = users.fetchUserByUsername.bind(users);
    let reads = 0;
    let release;
    const bothRead = new Promise((resolve) => { release = resolve; });
    users.fetchUserByUsername = async (username) => {
      const existing = await fetch(username);
      if (++reads === 2) release();
      await bothRead;
      return existing;
    };
    const config = new ConfigService({ NODE_ENV: "test", JWT_SECRET: "registration-test" });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: new AuthService(users, config) },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    const app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
    try {
      const register = () => request(app.getHttpServer()).post("/auth/register")
        .send({ username: "concurrent", password: "ExamplePass1!" });
      const responses = await Promise.all([register(), register()]);
      assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
      assert.equal(reads, 2);
      assert.equal(await database.getRepository(UserEntity).countBy({ username: "concurrent" }), 1);
      const winner = await repository.fetchUserByUsername("concurrent");
      const { verify } = await import("@node-rs/argon2");
      assert.equal(await verify(winner.hashedPassword, "ExamplePass1!"), true);
    } finally {
      await app.close();
    }
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

  it("gives existing and new users the member role by default", async () => {
    const roles = new TypeOrmRoleRepository(database.getRepository(RoleEntity));
    const role = await roles.fetchRoleByUserId("alice");
    assert.equal(role.id, "member");
    assert.equal(role.getPermissionBits(), 6n);
    assert.equal(role.hasPermission(Permission.Buy), true);
    assert.equal(await roles.fetchRoleByUserId("nobody"), null);
  });

  it("stores a role's permission bits and reads them back as a bigint", async () => {
    await unitOfWork.execute(async ({ roles }) => {
      await roles.save(new Role({ id: "auditor", name: "Kiểm toán", permission: 168n }));
    });
    try {
      const role = await new TypeOrmRoleRepository(database.getRepository(RoleEntity)).fetchRoleById("auditor");
      assert.equal(role.getPermissionBits(), 168n);
      assert.equal(role.hasPermission(Permission.ViewAnyOrder), true);
    } finally {
      await database.query(`DELETE FROM "roles" WHERE "id" = 'auditor'`);
    }
  });

  it("seeds the seven preset roles", async () => {
    const stored = await database.getRepository(RoleEntity).find({ order: { id: "ASC" } });
    assert.deepEqual(stored.map((role) => [role.id, role.permission]), [
      ["admin", 510n], ["member", 6n], ["no_buy", 4n], ["no_sell", 2n],
      ["order_handler", 238n], ["owner", 1n], ["support", 174n],
    ]);
  });
});
