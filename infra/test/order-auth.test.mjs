import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthorizationUseCase, OrderUseCase, UserUseCase } from "@shopeer/case";
import { Order, OrderItem, Permission, Role, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { OrderController } from "../dist/nest/modules/order/Order.controller.js";
import { HandlerOrderController } from "../dist/nest/modules/order/HandlerOrder.controller.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";

const secret = "order-authorization-test-secret";
const order = new Order({ orderId: "order", userId: "buyer", cartId: "cart", status: "pending", items: [
  new OrderItem({ orderItemId: "line", orderId: "order", productId: "product", unitPrice: 100, quantity: 1 }),
] });

describe("order endpoint authorization", () => {
  let app, bits, suspended, missingRole, operations;
  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController, HandlerOrderController],
      providers: [
        UserPipe,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: UserUseCase, useValue: { fetchUserById: async () => new User({ id: "buyer", username: "buyer", hashedPassword: "hash", suspended }) } },
        { provide: AuthorizationUseCase, useValue: new AuthorizationUseCase({ fetchRoleByUserId: async () => missingRole ? null : new Role({ id: "role", name: "Test", permission: bits }) }) },
        { provide: OrderUseCase, useValue: {
          checkout: async (id) => { operations.push(["checkout", id]); return order; },
          listOrders: async (id) => { operations.push(["list", id]); return [order]; },
          getOrder: async (id) => { operations.push(["get", id]); return order; },
          confirmReceipt: async (id) => { operations.push(["receipt", id]); return order; },
          confirmDelivery: async (id) => { operations.push(["delivery", id]); return order; },
          listHandlerOrders: async (query, status) => { operations.push(["handler-list", query.page, query.limit, status]); return [order]; },
          getHandlerOrder: async (id) => { operations.push(["handler-get", id]); return order; },
        } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => { bits = 1n << BigInt(Permission.Buy.offset); suspended = false; missingRole = false; operations = []; });

  for (const [method, path] of [["post", "/checkout"], ["get", "/orders"], ["get", "/orders/order"], ["post", "/orders/order/confirm-receipt"]]) {
    const send = (authenticated = true) => {
      const req = request(app.getHttpServer())[method](path);
      return authenticated ? req.set("Cookie", `access_token=${jwt.sign({ sub: "buyer" }, secret)}`) : req;
    };
    it(`${method} ${path} rejects missing authentication`, async () => {
      await send(false).expect(401);
      assert.deepEqual(operations, []);
    });
    it(`${method} ${path} rejects users without Buy before reaching the use case`, async () => {
      bits = 1n << BigInt(Permission.Sell.offset);
      await send().expect(403);
      assert.deepEqual(operations, []);
    });
    it(`${method} ${path} rejects users with no role`, async () => {
      missingRole = true;
      await send().expect(403);
      assert.deepEqual(operations, []);
    });
    it(`${method} ${path} allows Buy and Super`, async () => {
      await send().expect(path === "/checkout" ? 201 : 200);
      bits = 1n << BigInt(Permission.Super.offset);
      await send().expect(path === "/checkout" ? 201 : 200);
      assert.equal(operations.length, 2);
      assert.ok(operations.every(([, id]) => id === "buyer"));
    });
    it(`${method} ${path} rejects suspended users even with Super`, async () => {
      suspended = true;
      bits = 1n << BigInt(Permission.Super.offset);
      await send().expect(403);
      assert.deepEqual(operations, []);
    });
  }

  it("only handlers, admins and owners can confirm delivery", async () => {
    const send = () => request(app.getHttpServer()).post("/handler/orders/order/confirm-delivery")
      .set("Cookie", `access_token=${jwt.sign({ sub: "buyer" }, secret)}`);
    await request(app.getHttpServer()).post("/handler/orders/order/confirm-delivery").expect(401);
    for (bits of [6n, 174n]) await send().expect(403);
    assert.deepEqual(operations, []);
    for (bits of [238n, 510n, 1n]) await send().expect(200);
    assert.deepEqual(operations, [["delivery", "order"], ["delivery", "order"], ["delivery", "order"]]);
    suspended = true;
    await send().expect(403);
    assert.equal(operations.length, 3);
  });

  for (const path of ["/handler/orders", "/handler/orders/order"]) {
    it(`protects the handler read endpoint ${path}`, async () => {
      const send = () => request(app.getHttpServer()).get(path).set("Cookie", `access_token=${jwt.sign({ sub: "buyer" }, secret)}`);
      await request(app.getHttpServer()).get(path).expect(401);
      for (bits of [6n, 174n]) await send().expect(403);
      assert.deepEqual(operations, []);
      for (bits of [238n, 510n, 1n]) await send().expect(200);
      suspended = true;
      await send().expect(403);
      assert.equal(operations.length, 3);
    });
  }

  it("validates handler filters and pagination before reaching the use case", async () => {
    bits = 238n;
    const get = query => request(app.getHttpServer()).get(`/handler/orders${query}`).set("Cookie", `access_token=${jwt.sign({ sub: "buyer" }, secret)}`);
    for (const query of ["?status=unknown", "?status=pending&status=delivered", "?page=0", "?limit=101"]) await get(query).expect(400);
    assert.deepEqual(operations, []);
    const response = await get("?status=pending&page=2&limit=10").expect(200);
    assert.deepEqual(operations, [["handler-list", 2, 10, "pending"]]);
    assert.equal(response.headers["cache-control"], "no-store");
  });
});
