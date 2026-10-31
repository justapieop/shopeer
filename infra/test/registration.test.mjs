import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { UserUseCase } from "@shopeer/case";
import { User, UsernameAlreadyExistsError } from "@shopeer/domain";
import { DefaultNamingStrategy, QueryFailedError } from "typeorm";
import request from "supertest";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { TypeOrmUserRepository } from "../dist/nest/modules/user/User.repository.js";
import { DomainErrorFilter } from "../dist/nest/common/filters/DomainError.filter.js";
import { createOpenApiDocument } from "../dist/nest/openapi.js";

const naming = new DefaultNamingStrategy();
const uniqueConstraint = naming.uniqueConstraintName("users", ["username"]);
const uniqueIndex = naming.indexName("users", ["username"]);
const queryFailure = (code, constraint) => new QueryFailedError("INSERT INTO users", [],
  Object.assign(new Error("database failure"), { code, constraint }));
const user = new User({ id: "id", username: "alice", hashedPassword: "hash", suspended: false });

describe("registration persistence errors", () => {
  for (const constraint of [uniqueConstraint, uniqueIndex]) {
    it(`translates username uniqueness violation ${constraint}`, async () => {
      const repository = new TypeOrmUserRepository({
        manager: { queryRunner: { isTransactionActive: true, isReleased: false } },
        async insert() { throw queryFailure("23505", constraint); },
      });
      await assert.rejects(repository.create(user), UsernameAlreadyExistsError);
    });
  }

  for (const failure of [queryFailure("23505", "users_pkey"), queryFailure("23514", uniqueConstraint),
    queryFailure("23505", undefined), new Error("connection failed")]) {
    it(`preserves unrelated persistence failure: ${failure.driverError?.constraint ?? failure.message}`, async () => {
      const repository = new TypeOrmUserRepository({
        manager: { queryRunner: { isTransactionActive: true, isReleased: false } },
        async insert() { throw failure; },
      });
      await assert.rejects(repository.create(user), (error) => error === failure);
    });
  }
});

describe("registration HTTP conflicts", () => {
  let app, stored, lookups, inserts, releaseReads, bothRead, forceRace;
  before(async () => {
    const repository = new TypeOrmUserRepository({
      manager: { queryRunner: { isTransactionActive: true, isReleased: false } },
      async findOneBy({ username }) {
        const existing = stored.find((row) => row.username === username) ?? null;
        if (forceRace) {
          if (++lookups === 2) releaseReads();
          await bothRead;
        }
        return existing;
      },
      async insert(entity) {
        inserts++;
        if (stored.some((row) => row.username === entity.username)) throw queryFailure("23505", uniqueConstraint);
        stored.push(entity);
      },
    });
    const users = new UserUseCase({ execute: (work) => work({ users: repository }) }, repository);
    const config = new ConfigService({ JWT_SECRET: "test", NODE_ENV: "test" });
    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: new AuthService(users, config) },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    app.useGlobalFilters(new DomainErrorFilter());
    await app.init();
  });
  after(async () => { await app?.close(); });
  beforeEach(() => {
    stored = []; lookups = 0; inserts = 0; forceRace = false;
    bothRead = new Promise((resolve) => { releaseReads = resolve; });
  });
  const register = () => request(app.getHttpServer()).post("/auth/register")
    .send({ username: "alice", password: "ExamplePass1!" });

  it("returns one 201 and one 409 when both requests pass the existence check", { timeout: 10000 }, async () => {
    forceRace = true;
    const responses = await Promise.all([register(), register()]);
    assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
    assert.equal(lookups, 2);
    assert.equal(inserts, 2);
    assert.equal(stored.length, 1);
    const conflict = responses.find((response) => response.status === 409);
    assert.equal(conflict.body.error, "UsernameAlreadyExistsError");
    assert.equal(conflict.body.message, "User with username alice already exists");
    assert.equal(conflict.headers["set-cookie"], undefined);
  });

  it("returns the same conflict for an existing username without attempting another insert", async () => {
    await register().expect(201);
    const response = await register().expect(409);
    assert.equal(response.body.error, "UsernameAlreadyExistsError");
    assert.equal(inserts, 1);
    assert.equal(stored.length, 1);
  });

  it("documents invalid inputs as 400 and duplicate usernames as 409", () => {
    const responses = createOpenApiDocument(app).paths["/auth/register"].post.responses;
    assert.ok(responses[400]);
    assert.match(responses[409].description, /username/);
  });
});
