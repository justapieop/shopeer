import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { AuthorizationUseCase, OrderUseCase, ProductOwnershipUseCase, UserUseCase } from "@shopeer/case";
import { Order, OrderItem, Role, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { OrderController } from "../dist/nest/modules/order/Order.controller.js";
import { SellerOrderController } from "../dist/nest/modules/order/SellerOrder.controller.js";
import { ProductOwnershipController } from "../dist/nest/modules/product/ProductOwnership.controller.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";
import { DomainErrorFilter } from "../dist/nest/common/filters/DomainError.filter.js";

const secret = "order-view-test";
const bits = { buyer: 2n, seller: 4n, other: 4n, admin: 1n, unrelated: 0n };
const line = new OrderItem({ orderItemId: "line", orderId: "placed", productId: "mug", sellerId: "seller", name: "Coffee mug", imageUrl: "image", quantity: 2, unitPrice: 100 });
const order = new Order({ orderId: "placed", userId: "buyer", cartId: "cart", status: "pending", items: [line] });

describe("buyer and seller order views", () => {
  let app, assignments, suspended;
  const send = (method, path, user) => {
    const req = request(app.getHttpServer())[method](path);
    return user ? req.set("Cookie", `access_token=${jwt.sign({ sub: user }, secret)}`) : req;
  };
  before(async () => {
    const module = await Test.createTestingModule({ controllers: [OrderController, SellerOrderController, ProductOwnershipController], providers: [
      UserPipe,
      { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
      { provide: UserUseCase, useValue: { fetchUserById: async (id) => bits[id] !== undefined ? new User({ id, username: id, hashedPassword: "private", suspended }) : null } },
      { provide: AuthorizationUseCase, useValue: new AuthorizationUseCase({ fetchRoleByUserId: async (id) => new Role({ id, name: id, permission: bits[id] ?? 0n }) }) },
      { provide: OrderUseCase, useValue: new OrderUseCase({}, {
        fetchOrderById: async (id) => id === "placed" ? order : null,
        fetchOrdersByUserId: async (id) => id === "buyer" ? [order] : [],
        fetchOrderBySellerId: async (id, orderId) => id === "seller" && orderId === "placed" ? order : null,
        fetchOrdersBySellerId: async (id) => id === "seller" ? [order] : [],
      }, {}) },
      { provide: ProductOwnershipUseCase, useValue: { assignSeller: async (...args) => { assignments.push(args); } } },
    ] }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => { assignments = []; suspended = false; });

  for (const path of ["/orders", "/orders/placed", "/seller/orders", "/seller/orders/placed"]) {
    it(`${path} requires authentication`, async () => { await send("get", path).expect(401); });
  }
  it("returns the buyer's persisted status, names and purchase totals without private domain data", async () => {
    const response = await send("get", "/orders/placed", "buyer").expect(200);
    assert.equal(response.headers["cache-control"], "no-store");
    assert.equal(response.body.status, "pending");
    assert.equal(response.body.items[0].name, "Coffee mug");
    assert.equal(response.body.totalAmount, 200);
    assert.doesNotMatch(JSON.stringify(response.body), /hashedPassword|sellerId|cartId|userId|details/);
  });
  it("does not allow a buyer to query seller orders", async () => { await send("get", "/seller/orders", "buyer").expect(403); });
  it("does not let a seller without Buy access buyer order routes", async () => { await send("get", "/orders", "seller").expect(403); });
  it("does not reveal another buyer's order even to Super", async () => { await send("get", "/orders/placed", "admin").expect(404); });
  it("scopes seller queries to the cookie identity and returns 404 for another seller's order", async () => {
    const response = await send("get", "/seller/orders?sellerId=seller", "other").expect(200);
    assert.deepEqual(response.body, []);
    await send("get", "/seller/orders/placed", "other").expect(404);
    await send("get", "/seller/orders/placed", "seller").expect(200);
    await send("get", "/seller/orders/placed", "admin").expect(404);
  });
  it("denies suspended sellers", async () => { suspended = true; await send("get", "/seller/orders", "seller").expect(403); });
  for (const actor of [undefined, "buyer", "seller", "unrelated"]) {
    it(`denies product assignment by ${actor ?? "anonymous"}`, async () => {
      await send("put", "/admin/products/mug/seller", actor).send({ sellerId: "seller" }).expect(actor ? 403 : 401);
      assert.deepEqual(assignments, []);
    });
  }
  it("allows Super to assign a product and validates the body", async () => {
    await send("put", "/admin/products/mug/seller", "admin").send({ sellerId: "seller" }).expect(200);
    assert.deepEqual(assignments, [["mug", "seller"]]);
    await send("put", "/admin/products/mug/seller", "admin").send({ sellerId: 12 }).expect(400);
  });
});
