import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { Controller, Get, Module, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { UserUseCase } from "@shopeer/case";
import { User as DomainUser } from "@shopeer/domain";
import jwt from "jsonwebtoken";
import request from "supertest";
import cookieParser from "cookie-parser";
import { User } from "../dist/nest/common/decorators/User.decorator.js";

const secret = "user-decorator-test-secret";
let storedUser;
let receivedUser;
let lookups;
let databaseError;

class TestController {
  current(user) {
    receivedUser = user;
    return { id: user.id };
  }

  suspended(user) {
    receivedUser = user;
    return { id: user.id };
  }
}

Controller()(TestController);
for (const [method, options] of [["current", undefined], ["suspended", { allowSuspended: true }]]) {
  Get(method)(TestController.prototype, method, Object.getOwnPropertyDescriptor(TestController.prototype, method));
  User(options)(TestController.prototype, method, 0);
}

// Resolve the decorator's pipe through Nest's DI, including imported providers.
class TestUserModule {}
Module({
  providers: [
    { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
    {
      provide: UserUseCase,
      useValue: new UserUseCase({
        async execute() { throw new Error("Authentication reads must not start a write transaction"); },
      }, {
        async fetchUserById(id) {
          lookups.push(id);
          if (databaseError) throw databaseError;
          return storedUser?.id === id ? storedUser : null;
        },
      }),
    },
  ],
  exports: [ConfigService, UserUseCase],
})(TestUserModule);

describe("@User", () => {
  let app;
  const token = (payload = { sub: "user-id" }, options = {}) => jwt.sign(payload, secret, options);
  const get = (cookie, path = "/current") => {
    const response = request(app.getHttpServer()).get(path);
    return cookie === undefined ? response : response.set("Cookie", cookie);
  };

  before(async () => {
    const module = await Test.createTestingModule({
      imports: [TestUserModule],
      controllers: [TestController],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();
  });

  after(async () => { await app?.close(); });

  beforeEach(() => {
    storedUser = new DomainUser({
      id: "user-id",
      username: "databaseuser",
      hashedPassword: "stored-password-hash",
      createdAt: new Date("2026-01-01T00:00:00Z"),
      suspended: false,
    });
    receivedUser = undefined;
    lookups = [];
    databaseError = undefined;
  });

  it("looks up the verified subject and passes the complete database user to the controller", async () => {
    await get(`access_token=${token({ sub: storedUser.id, username: "stale-token-name" })}`).expect(200);
    assert.deepEqual(lookups, [storedUser.id]);
    assert.equal(receivedUser, storedUser);
  });

  it("finds the access token among other cookies", async () => {
    await get(`theme=dark; access_token=${token()}`).expect(200);
    assert.equal(receivedUser, storedUser);
  });

  for (const header of [undefined, "theme=dark", "access_token=", "access_token=%20%20", "access_token=j:123", "access_token=j:%7B%7D"]) {
    it(`rejects a missing or malformed cookie: ${header}`, async () => {
      await get(header).expect(401);
      assert.deepEqual(lookups, []);
      assert.equal(receivedUser, undefined);
    });
  }

  for (const [name, makeToken] of [
    ["malformed", () => "not-a-jwt"],
    ["wrong signature", () => jwt.sign({ sub: "user-id" }, "wrong-secret")],
    ["expired", () => token({ sub: "user-id" }, { expiresIn: -1 })],
    ["not yet active", () => token({ sub: "user-id" }, { notBefore: "1h" })],
    ["unsupported algorithm", () => token({ sub: "user-id" }, { algorithm: "HS384" })],
    ["missing subject", () => token({})],
    ["empty subject", () => token({ sub: "" })],
    ["blank subject", () => token({ sub: "  " })],
    ["non-string subject", () => token({ sub: 123 })],
    ["string payload", () => token("user-id")],
  ]) {
    it(`rejects a ${name} token before querying the database`, async () => {
      await get(`access_token=${makeToken()}`).expect(401);
      assert.deepEqual(lookups, []);
      assert.equal(receivedUser, undefined);
    });
  }

  it("rejects a valid subject that has no database user", async () => {
    await get(`access_token=${token({ sub: "deleted-user" })}`).expect(401);
    assert.deepEqual(lookups, ["deleted-user"]);
    assert.equal(receivedUser, undefined);
  });

  it("rejects suspended users by default", async () => {
    storedUser = new DomainUser({ ...storedUser, suspended: true });
    await get(`access_token=${token()}`).expect(403);
    assert.equal(receivedUser, undefined);
  });

  it("returns suspended users when explicitly allowed", async () => {
    storedUser = new DomainUser({ ...storedUser, suspended: true });
    await get(`access_token=${token()}`, "/suspended").expect(200);
    assert.equal(receivedUser, storedUser);
  });

  it("preserves database failures as server errors", async () => {
    databaseError = new Error("Database unavailable");
    await get(`access_token=${token()}`).expect(500);
    assert.equal(receivedUser, undefined);
  });
});
