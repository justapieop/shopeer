import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { CartUseCase, UserUseCase } from "@shopeer/case";
import { Cart, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { CartController } from "../dist/nest/modules/cart/Cart.controller.js";

let storedUser;

describe("cart listing authentication", () => {
  let app, authService, cartLookups, config;

  before(async () => {
    storedUser = new User({ id: "cart-user", username: "buyer", hashedPassword: await hash("password"), suspended: false });
    config = new ConfigService({ JWT_SECRET: "cart-auth-test-secret", NODE_ENV: "test" });
    authService = new AuthService({ fetchUserByUsername: async (name) => name === storedUser.username ? storedUser : null }, config);
    const module = await Test.createTestingModule({
      controllers: [AuthController, CartController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: AuthService, useValue: authService },
        { provide: UserUseCase, useValue: { fetchUserById: async (id) => id === storedUser.id ? storedUser : null } },
        { provide: CartUseCase, useValue: {
          async getCart(userId) {
            cartLookups.push(userId);
            return { cart: new Cart({ cartId: "cart-1", userId }), lines: [], totalQuantity: 0, totalAmount: 0 };
          },
        } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => { cartLookups = []; config.set("NODE_ENV", "test"); });

  it("lists the cart after login using the cookie automatically", async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post("/auth/login").send({ username: "buyer", password: "password" }).expect(201);
    const cookie = login.headers["set-cookie"][0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /Max-Age=3600/);
    assert.match(cookie, /Path=\//);
    assert.doesNotMatch(cookie, /; Secure/);
    assert.equal(login.body.accessToken, undefined);
    assert.equal(login.body.access_token, undefined);
    const response = await agent.get("/cart").expect(200);
    assert.deepEqual(response.body, { cartId: "cart-1", items: [], totalQuantity: 0, totalAmount: 0 });
    assert.deepEqual(cartLookups, [storedUser.id]);
  });

  it("returns 401 without a cookie", async () => {
    const response = await request(app.getHttpServer()).get("/cart").expect(401);
    assert.equal(response.body.message, "Missing access token");
    assert.deepEqual(cartLookups, []);
  });

  it("sets Secure cookies in production", async () => {
    config.set("NODE_ENV", "production");
    const login = await request(app.getHttpServer()).post("/auth/login").send({ username: "buyer", password: "password" }).expect(201);
    assert.match(login.headers["set-cookie"][0], /; Secure/);
  });

  it("does not issue a cookie for invalid credentials", async () => {
    const login = await request(app.getHttpServer()).post("/auth/login").send({ username: "buyer", password: "wrong-password" }).expect(400);
    assert.equal(login.headers["set-cookie"], undefined);
  });

  it("does not accept bearer tokens as a fallback", async () => {
    await request(app.getHttpServer()).get("/cart")
      .set("Authorization", `Bearer ${authService.signToken(storedUser)}`).expect(401);
    assert.deepEqual(cartLookups, []);
  });

  it("does not fall back to a bearer token when the cookie is invalid", async () => {
    await request(app.getHttpServer()).get("/cart")
      .set("Cookie", "access_token=invalid")
      .set("Authorization", `Bearer ${authService.signToken(storedUser)}`).expect(401);
    assert.deepEqual(cartLookups, []);
  });

  it("returns 401 for the obsolete X-User-Id example", async () => {
    const response = await request(app.getHttpServer()).get("/cart").set("X-User-Id", storedUser.id).expect(401);
    assert.equal(response.body.message, "Missing access token");
    assert.deepEqual(cartLookups, []);
  });
});
