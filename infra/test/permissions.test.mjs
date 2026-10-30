import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { Controller, Get } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { AuthorizationUseCase, UserUseCase } from "@shopeer/case";
import { Permission, Role, User } from "@shopeer/domain";
import jwt from "jsonwebtoken";
import request from "supertest";
import cookieParser from "cookie-parser";
import { RequirePermissions } from "../dist/nest/common/decorators/RequirePermissions.decorator.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";
import { PermissionsGuard } from "../dist/nest/common/guards/Permissions.guard.js";

const secret = "permissions-test-secret";
let bits, suspended, missingUser, missingRole, databaseError, calls, roleLookups;

class ProtectedController {
  buy() { calls++; return {}; }
  sell() { calls++; return {}; }
}
Controller("protected")(ProtectedController);
RequirePermissions(Permission.Buy)(ProtectedController);
for (const method of ["buy", "sell"]) {
  const descriptor = Object.getOwnPropertyDescriptor(ProtectedController.prototype, method);
  Get(method)(ProtectedController.prototype, method, descriptor);
  if (method === "sell") RequirePermissions(Permission.Sell)(ProtectedController.prototype, method, descriptor);
}

class PublicController { index() { return {}; } }
Controller()(PublicController);
Get("public")(PublicController.prototype, "index", Object.getOwnPropertyDescriptor(PublicController.prototype, "index"));
RequirePermissions()(PublicController);

describe("permission enforcement", () => {
  let app;
  const get = (path = "/protected/buy", cookie = `access_token=${jwt.sign({ sub: "user-id" }, secret)}`) => {
    const response = request(app.getHttpServer()).get(path);
    return cookie === null ? response : response.set("Cookie", cookie);
  };

  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [ProtectedController, PublicController],
      providers: [
        PermissionsGuard, UserPipe,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: UserUseCase, useValue: {
          async fetchUserById(id) {
            if (databaseError) throw databaseError;
            return missingUser ? null : new User({ id, username: "member", hashedPassword: "hash", suspended });
          },
        } },
        { provide: AuthorizationUseCase, useValue: new AuthorizationUseCase({
          async fetchRoleByUserId(id) {
            assert.equal(id, "user-id");
            roleLookups++;
            return missingRole ? null : new Role({ id: "role", name: "Test", permission: bits });
          },
        }) },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => {
    bits = 6n;
    suspended = missingUser = missingRole = false;
    databaseError = undefined;
    calls = roleLookups = 0;
  });

  it("allows a role with the required permission", async () => {
    await get().expect(200);
    assert.equal(calls, 1);
  });
  it("denies a missing permission before the controller runs", async () => {
    bits = 4n;
    await get().expect(403);
    assert.equal(calls, 0);
  });
  it("requires both controller and method permissions", async () => {
    bits = 2n;
    await get("/protected/sell").expect(403);
    bits = 4n;
    await get("/protected/sell").expect(403);
    assert.equal(calls, 0);
    bits = 6n;
    await get("/protected/sell").expect(200);
  });
  it("grants Super every required permission", async () => {
    bits = 1n;
    await get("/protected/sell").expect(200);
  });
  it("denies users without a role", async () => {
    missingRole = true;
    await get().expect(403);
    assert.equal(calls, 0);
  });
  for (const header of [null, "access_token=", "access_token=invalid", `access_token=${jwt.sign({ sub: "user-id" }, secret, { expiresIn: -1 })}`]) {
    it(`rejects invalid authentication: ${header}`, async () => {
      await get("/protected/buy", header).expect(401);
      assert.equal(calls, 0);
      assert.equal(roleLookups, 0);
    });
  }
  it("rejects deleted users", async () => {
    missingUser = true;
    await get().expect(401);
    assert.equal(roleLookups, 0);
  });
  it("rejects suspended users even with Super", async () => {
    suspended = true;
    bits = 1n;
    await get().expect(403);
    assert.equal(roleLookups, 0);
  });
  it("reloads the role so permission changes affect the next request", async () => {
    await get().expect(200);
    bits = 0n;
    await get().expect(403);
    assert.equal(roleLookups, 2);
  });
  it("preserves database failures as server errors", async () => {
    databaseError = new Error("Database unavailable");
    await get().expect(500);
    assert.equal(calls, 0);
  });
  it("allows routes without requirements without authentication", async () => {
    await get("/public", null).expect(200);
    assert.equal(roleLookups, 0);
  });
});
