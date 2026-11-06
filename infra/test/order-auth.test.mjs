import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AuthorizationUseCase, OrderUseCase, UserUseCase } from "@shopeer/case";
import { Order, OrderItem, Permission, Role, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { OrderController } from "../dist/nest/modules/order/Order.controller.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";

const secret = "order-authorization-test-secret";
const order = new Order({ orderId: "order", userId: "buyer", cartId: "cart", status: "pending", items: [
  new OrderItem({ orderItemId: "line", orderId: "order", productId: "product", unitPrice: 100, quantity: 1 }),
] });

describe("order endpoint authorization", () => {
  let app, bits, suspended, missingRole, operations;
  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [OrderController],
      providers: [
        UserPipe,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: UserUseCase, useValue: { fetchUserById: async () => new User({ id: "buyer", username: "buyer", hashedPassword: "hash", suspended }) } },
        { provide: AuthorizationUseCase, useValue: new AuthorizationUseCase({ fetchRoleByUserId: async () => missingRole ? null : new Role({ id: "role", name: "Test", permission: bits }) }) },
        { provide: OrderUseCase, useValue: {
          checkout: async (id) => { operations.push(["checkout", id]); return order; },
          listOrders: async (id) => { operations.push(["list", id]); return [order]; },
          getOrder: async (id) => { operations.push(["get", id]); return order; },
        } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => { bits = 1n << BigInt(Permission.Buy.offset); suspended = false; missingRole = false; operations = []; });

  for (const [method, path] of [["post", "/checkout"], ["get", "/orders"], ["get", "/orders/order"]]) {
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
      await send().expect(method === "post" ? 201 : 200);
      bits = 1n << BigInt(Permission.Super.offset);
      await send().expect(method === "post" ? 201 : 200);
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
});
