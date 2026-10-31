import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { OrderUseCase, ProductUseCase, UserUseCase } from "@shopeer/case";
import { Category, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { ProductController } from "../dist/nest/modules/product/Product.controller.js";
import { TypeOrmProductRepository } from "../dist/nest/modules/product/Product.repository.js";
import { OrderController } from "../dist/nest/modules/order/Order.controller.js";
import { TypeOrmOrderRepository } from "../dist/nest/modules/order/Order.repository.js";
import { InMemoryCacheManager } from "../dist/nest/common/cache/InMemoryCacheManager.js";
import { DomainErrorFilter } from "../dist/nest/common/filters/DomainError.filter.js";
import { createOpenApiDocument } from "../dist/nest/openapi.js";

describe("login validation and paginated listings", () => {
  let app, loginCalls, productQueries, orderQueries, itemQueries, cache;
  const user = new User({ id: "alice", username: "alice", hashedPassword: "hash", suspended: false });
  const secret = "pagination-test-secret";
  const cookie = `access_token=${jwt.sign({ sub: user.id }, secret)}`;
  // Equal sort values exercise the ID tie-breaker across page boundaries.
  const products = Array.from({ length: 25 }, (_, index) => ({
    id: `p${String(index).padStart(2, "0")}`, name: "Same name", description: "Product",
    price: 100, stock: 10, categoryId: index < 12 ? "books" : "shoes", imageUrl: "image",
  }));
  const orders = Array.from({ length: 25 }, (_, index) => ({
    id: `o${String(index).padStart(2, "0")}`, userId: index < 23 ? "alice" : "bob",
    cartId: "cart", totalAmount: 100, createdAt: new Date("2026-01-01T00:00:00Z"),
  }));

  before(async () => {
    const productRepository = new TypeOrmProductRepository({
      async find(options) {
        productQueries.push(options);
        assert.deepEqual(options.order, { name: "ASC", id: "ASC" });
        const rows = products.filter((row) => !options.where || row.categoryId === options.where.categoryId);
        return rows.slice(options.skip, options.skip + options.take);
      },
    });
    const orderRepository = new TypeOrmOrderRepository({
      async find(options) {
        orderQueries.push(options);
        assert.deepEqual(options.order, { createdAt: "DESC", id: "DESC" });
        const rows = orders.filter((row) => row.userId === options.where.userId).toReversed();
        return rows.slice(options.skip, options.skip + options.take);
      },
    }, {
      async find(options) {
        itemQueries.push(options);
        return options.where.orderId.value.map((id) => ({
          id: `item-${id}`, orderId: id, productId: "p00", unitPrice: 100, quantity: 1,
        }));
      },
    });
    const module = await Test.createTestingModule({
      controllers: [AuthController, ProductController, OrderController],
      providers: [
        { provide: AuthService, useValue: {
          async login(username, password) { loginCalls.push({ username, password }); return user; },
          signToken: () => "token",
        } },
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret, NODE_ENV: "test" }) },
        { provide: UserUseCase, useValue: { fetchUserById: async () => user } },
        { provide: ProductUseCase, useValue: new ProductUseCase(productRepository, {
          fetchCategoryById: async (id) => new Category({ categoryId: id, name: id }),
        }) },
        { provide: OrderUseCase, useValue: new OrderUseCase({}, orderRepository, {}) },
        { provide: InMemoryCacheManager, useValue: {
          async getOrLoad(namespace, key, load) {
            const cacheKey = `${namespace}:${key}`;
            if (!cache.has(cacheKey)) cache.set(cacheKey, await load());
            return cache.get(cacheKey);
          },
        } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => { loginCalls = []; productQueries = []; orderQueries = []; itemQueries = []; cache = new Map(); });

  for (const body of [
    {}, { username: "alice" }, { password: "password" },
    ...[null, 123, true, [], {}, "", " \t\n"].flatMap((value) => [
      { username: value, password: "password" }, { username: "alice", password: value },
    ]),
    { username: "a".repeat(257), password: "password" },
    { username: "alice", password: "p".repeat(1025) },
  ]) {
    it(`rejects malformed login ${JSON.stringify(body).slice(0, 90)}`, async () => {
      const response = await request(app.getHttpServer()).post("/auth/login").send(body).expect(400);
      assert.equal(response.headers["set-cookie"], undefined);
      assert.deepEqual(loginCalls, []);
    });
  }

  it("preserves passwords exactly and accepts existing passwords without new strength requirements", async () => {
    await request(app.getHttpServer()).post("/auth/login")
      .send({ username: "alice", password: " old password " }).expect(201);
    assert.deepEqual(loginCalls, [{ username: "alice", password: " old password " }]);
  });

  it("defaults to 20 products and separates cached pages and page sizes", async () => {
    const first = await request(app.getHttpServer()).get("/products").expect(200);
    const second = await request(app.getHttpServer()).get("/products?page=2").expect(200);
    const smaller = await request(app.getHttpServer()).get("/products?limit=5").expect(200);
    assert.equal(first.body.length, 20);
    assert.deepEqual(second.body.map((row) => row.productId), ["p20", "p21", "p22", "p23", "p24"]);
    assert.equal(smaller.body.length, 5);
    assert.deepEqual((await request(app.getHttpServer()).get("/products?page=2").expect(200)).body, second.body);
    assert.equal(productQueries.length, 3);
    assert.deepEqual(productQueries.map(({ skip, take }) => [skip, take]), [[0, 20], [20, 20], [0, 5]]);
  });

  it("filters categories before pagination and returns empty pages", async () => {
    const response = await request(app.getHttpServer()).get("/products?categoryId=books&page=2&limit=10").expect(200);
    assert.deepEqual(response.body.map((row) => row.productId), ["p10", "p11"]);
    assert.deepEqual((await request(app.getHttpServer()).get("/products?page=10").expect(200)).body, []);
    const shoes = await request(app.getHttpServer()).get("/products?categoryId=shoes&page=2&limit=10").expect(200);
    assert.deepEqual(shoes.body.map((row) => row.productId), ["p22", "p23", "p24"]);
  });

  it("paginates only the authenticated user's orders and loads only that page's items", async () => {
    const first = await request(app.getHttpServer()).get("/orders").set("Cookie", cookie).expect(200);
    const second = await request(app.getHttpServer()).get("/orders?page=2").set("Cookie", cookie).expect(200);
    assert.equal(first.body.length, 20);
    assert.deepEqual(second.body.map((row) => row.orderId), ["o02", "o01", "o00"]);
    assert.equal(second.body[0].items.length, 1);
    assert.deepEqual(itemQueries[1].where.orderId.value, ["o02", "o01", "o00"]);
    const empty = await request(app.getHttpServer()).get("/orders?page=3").set("Cookie", cookie).expect(200);
    assert.deepEqual(empty.body, []);
    assert.equal(itemQueries.length, 2);
    await request(app.getHttpServer()).get("/orders").expect(401);
  });

  for (const query of ["page=0", "page=-1", "page=1.5", "page=abc", "page=", "page=1&page=2",
    "page=9007199254740992", "page=9007199254740991&limit=100", "limit=0", "limit=101", "limit=1.5", "limit=", "limit=1e2"]) {
    it(`rejects invalid pagination ${query} before querying persistence`, async () => {
      await request(app.getHttpServer()).get(`/products?${query}`).expect(400);
      await request(app.getHttpServer()).get(`/orders?${query}`).set("Cookie", cookie).expect(400);
      assert.deepEqual(productQueries, []);
      assert.deepEqual(orderQueries, []);
    });
  }

  it("documents pagination defaults and bounds on both routes", () => {
    const document = createOpenApiDocument(app);
    for (const path of ["/products", "/orders"]) {
      const parameters = document.paths[path].get.parameters;
      assert.equal(parameters.find((p) => p.name === "page").schema.default, 1);
      const limit = parameters.find((p) => p.name === "limit");
      assert.equal(limit.schema.default, 20);
      assert.equal(limit.schema.maximum, 100);
      assert.ok(document.paths[path].get.responses[400]);
    }
  });
});
