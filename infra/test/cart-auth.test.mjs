import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AuthorizationUseCase, CartUseCase, UserUseCase } from "@shopeer/case";
import { Cart, User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import { hash } from "@node-rs/argon2";
import request from "supertest";
import jwt from "jsonwebtoken";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { CartController } from "../dist/nest/modules/cart/Cart.controller.js";
import { PermissionsGuard } from "../dist/nest/common/guards/Permissions.guard.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";

let storedUser;

describe("cart listing authentication", () => {
  let app, authService, cartLookups, config, userExists;

  before(async () => {
    storedUser = new User({ id: "cart-user", username: "buyer", hashedPassword: await hash("password"), suspended: false });
    config = new ConfigService({ JWT_SECRET: "cart-auth-test-secret", NODE_ENV: "test" });
    authService = new AuthService({
      fetchUserByUsername: async (name) => name === storedUser.username ? storedUser : null,
      fetchUserById: async (id) => userExists && id === storedUser.id ? storedUser : null,
    }, config);
    const module = await Test.createTestingModule({
      controllers: [AuthController, CartController],
      providers: [
        { provide: ConfigService, useValue: config },
        { provide: AuthService, useValue: authService },
        PermissionsGuard,
        UserPipe,
        { provide: AuthorizationUseCase, useValue: { hasPermissions: async () => true } },
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
  beforeEach(() => { cartLookups = []; userExists = true; config.set("NODE_ENV", "test"); });

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
    assert.equal(login.body.refreshToken, undefined);
    assert.equal(login.body.refresh_token, undefined);
    const refreshCookie = login.headers["set-cookie"].find((value) => value.startsWith("refresh_token="));
    assert.match(refreshCookie, /HttpOnly/);
    assert.match(refreshCookie, /SameSite=Strict/);
    assert.match(refreshCookie, /Max-Age=604800/);
    assert.match(refreshCookie, /Path=\/auth\/refresh;/);
    assert.doesNotMatch(refreshCookie, /; Secure/);
    const refreshToken = refreshCookie.split(";")[0].slice("refresh_token=".length);
    const claims = jwt.verify(refreshToken, config.get("JWT_SECRET"), { algorithms: ["HS256"] });
    assert.equal(claims.sub, storedUser.id);
    assert.equal(claims.token_use, "refresh");
    assert.equal(claims.exp - claims.iat, 604800);
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
    assert.match(login.headers["set-cookie"][1], /; Secure/);
  });

  it("renews access using only the login refresh cookie and keeps its original expiry", async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post("/auth/login").send({ username: "buyer", password: "password" }).expect(201);
    // Override access with an expired token; refresh must not depend on it.
    const expired = jwt.sign({ sub: storedUser.id, token_use: "access" }, config.get("JWT_SECRET"), { expiresIn: -1 });
    const response = await agent.post("/auth/refresh").set("Cookie", `access_token=${expired}`).expect(200);
    assert.equal(response.body.id, storedUser.id);
    assert.deepEqual(Object.keys(response.body).sort(), ["createdAt", "id", "suspended", "username"]);
    assert.equal(response.headers["set-cookie"].length, 1);
    const access = response.headers["set-cookie"][0].split(";")[0].slice("access_token=".length);
    const claims = jwt.verify(access, config.get("JWT_SECRET"), { algorithms: ["HS256"] });
    assert.equal(claims.token_use, "access");
    assert.equal(claims.exp - claims.iat, 3600);
    await agent.get("/cart").expect(200);
    await agent.post("/auth/refresh").expect(200);
  });

  it("rejects refresh tokens used as access tokens", async () => {
    await request(app.getHttpServer()).get("/cart")
      .set("Cookie", `access_token=${authService.signRefreshToken(storedUser)}`).expect(401);
    assert.deepEqual(cartLookups, []);
  });

  for (const [name, makeToken] of [
    ["missing", () => undefined],
    ["empty", () => ""],
    ["malformed", () => "invalid"],
    ["access", () => authService.signToken(storedUser)],
    ["legacy access", () => jwt.sign({ sub: storedUser.id }, config.get("JWT_SECRET"))],
    ["expired", () => jwt.sign({ sub: storedUser.id, token_use: "refresh" }, config.get("JWT_SECRET"), { expiresIn: -1 })],
    ["wrong secret", () => jwt.sign({ sub: storedUser.id, token_use: "refresh" }, "wrong-secret", { expiresIn: "7d" })],
    ["wrong algorithm", () => jwt.sign({ sub: storedUser.id, token_use: "refresh" }, config.get("JWT_SECRET"), { algorithm: "HS384", expiresIn: "7d" })],
    ["missing expiry", () => jwt.sign({ sub: storedUser.id, token_use: "refresh" }, config.get("JWT_SECRET"))],
    ["empty subject", () => jwt.sign({ sub: " ", token_use: "refresh" }, config.get("JWT_SECRET"), { expiresIn: "7d" })],
  ]) {
    it(`rejects ${name} refresh credentials without setting cookies`, async () => {
      const token = makeToken();
      const req = request(app.getHttpServer()).post("/auth/refresh");
      if (token !== undefined) req.set("Cookie", `refresh_token=${token}`);
      const response = await req.expect(401);
      assert.equal(response.headers["set-cookie"], undefined);
    });
  }

  it("rejects refresh for a deleted user", async () => {
    const token = authService.signRefreshToken(storedUser);
    userExists = false;
    await request(app.getHttpServer()).post("/auth/refresh").set("Cookie", `refresh_token=${token}`).expect(401);
  });

  it("rejects refresh for a suspended user", async () => {
    const service = new AuthService({ fetchUserById: async () => ({ ...storedUser, suspended: true }) }, config);
    await assert.rejects(service.refresh(authService.signRefreshToken(storedUser)), { status: 403 });
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
