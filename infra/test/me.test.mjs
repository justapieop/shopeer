import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { UserUseCase } from "@shopeer/case";
import { User } from "@shopeer/domain";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import request from "supertest";
import { UserController } from "../dist/nest/modules/user/User.controller.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";

describe("GET /user/me", () => {
  const secret = "me-test-secret";
  let app, storedUser;
  const cookie = (payload = { sub: "self-user" }, options = {}) =>
    `access_token=${jwt.sign(payload, secret, { algorithm: "HS256", ...options })}`;

  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [UserController],
      providers: [
        UserPipe,
        { provide: ConfigService, useValue: new ConfigService({ JWT_SECRET: secret }) },
        { provide: UserUseCase, useValue: { fetchUserById: async (id) => id === storedUser.id ? storedUser : null } },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.use(cookieParser());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => {
    storedUser = new User({ id: "self-user", username: "alice", hashedPassword: "private-password-hash", suspended: false });
  });

  it("returns only the authenticated user's public fields and prevents caching", async () => {
    const { body, headers } = await request(app.getHttpServer()).get("/user/me?userId=another-user")
      .set("Cookie", cookie()).expect(200);
    assert.deepEqual(body, {
      id: storedUser.id, username: storedUser.username,
      createdAt: storedUser.createdAt.toISOString(), suspended: false,
    });
    assert.equal(headers["cache-control"], "private, no-store");
    assert.doesNotMatch(JSON.stringify(body), /private-password-hash|hashedPassword|details|access_token/);
  });

  it("requires the authentication cookie and rejects bearer-only requests", async () => {
    await request(app.getHttpServer()).get("/user/me").expect(401);
    await request(app.getHttpServer()).get("/user/me")
      .set("Authorization", `Bearer ${jwt.sign({ sub: storedUser.id }, secret)}`).expect(401);
  });

  it("rejects invalid and expired cookies", async () => {
    await request(app.getHttpServer()).get("/user/me").set("Cookie", "access_token=invalid").expect(401);
    await request(app.getHttpServer()).get("/user/me").set("Cookie", cookie({ sub: storedUser.id }, { expiresIn: -1 })).expect(401);
  });

  it("rejects a token whose user no longer exists", async () => {
    await request(app.getHttpServer()).get("/user/me").set("Cookie", cookie({ sub: "deleted-user" })).expect(401);
  });

  it("rejects suspended users consistently with the other authenticated routes", async () => {
    storedUser = new User({ id: "self-user", username: "alice", hashedPassword: "private-password-hash", suspended: true });
    await request(app.getHttpServer()).get("/user/me").set("Cookie", cookie()).expect(403);
  });
});
