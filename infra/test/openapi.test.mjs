import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { CartUseCase, OrderUseCase, ProductUseCase, UserUseCase } from "@shopeer/case";
import { User } from "@shopeer/domain";
import request from "supertest";
import { createOpenApiDocument, setupOpenApi } from "../dist/nest/openapi.js";
import { AuthController } from "../dist/nest/modules/auth/Auth.controller.js";
import { AuthService } from "../dist/nest/modules/auth/Auth.service.js";
import { CartController } from "../dist/nest/modules/cart/Cart.controller.js";
import { OrderController } from "../dist/nest/modules/order/Order.controller.js";
import { ProductController, CategoryController } from "../dist/nest/modules/product/Product.controller.js";
import { UserController } from "../dist/nest/modules/user/User.controller.js";
import { InMemoryCacheManager } from "../dist/nest/common/cache/InMemoryCacheManager.js";

const routes = [
  ["post", "/auth/register", "201"], ["post", "/auth/login", "201"],
  ["get", "/user/{id}", "200"],
  ["get", "/products", "200"], ["get", "/products/{productId}", "200"], ["get", "/categories", "200"],
  ["get", "/cart", "200"], ["delete", "/cart", "200"], ["post", "/cart/items", "200"],
  ["patch", "/cart/items/{productId}", "200"], ["delete", "/cart/items/{productId}", "200"],
  ["post", "/checkout", "201"], ["get", "/orders", "200"], ["get", "/orders/{orderId}", "200"],
];

const storedUser = new User({ id: "user-1", username: "alice", hashedPassword: "secret-hash", suspended: false });

describe("OpenAPI documentation", () => {
  let app, document;

  before(async () => {
    const module = await Test.createTestingModule({
      controllers: [AuthController, CartController, OrderController, ProductController, CategoryController, UserController],
      providers: [
        { provide: AuthService, useValue: { registration: async () => storedUser, login: async () => storedUser, signToken: () => "signed-jwt" } },
        { provide: CartUseCase, useValue: {} },
        { provide: OrderUseCase, useValue: {} },
        { provide: ProductUseCase, useValue: {} },
        { provide: UserUseCase, useValue: { fetchUserById: async (id) => id === "user-1" ? storedUser : null } },
        { provide: ConfigService, useValue: {} },
        { provide: InMemoryCacheManager, useValue: {} },
      ],
    }).compile();
    app = module.createNestApplication({ logger: false });
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    setupOpenApi(app);
    await app.init();
    document = createOpenApiDocument(app);
  });

  after(async () => { await app?.close(); });

  it("serves Swagger UI and both raw specification formats at the documented URLs", async () => {
    const json = await request(app.getHttpServer()).get("/openapi.json").expect(200);
    assert.equal(json.body.info.title, "Shopeer API");
    assert.ok(json.body.paths["/checkout"].post);
    const yaml = await request(app.getHttpServer()).get("/openapi.yaml").expect(200);
    assert.match(yaml.text, /openapi:/);
    const ui = await request(app.getHttpServer()).get("/docs/").expect(200);
    assert.match(ui.text, /swagger-ui/);
  });

  it("omits password hashes and details from actual profile, registration, and login responses", async () => {
    assert.ok(storedUser.details.hashedPassword, "fixture must include the previously exposed internal object");
    const profile = await request(app.getHttpServer()).get("/user/user-1").expect(200);
    const registration = await request(app.getHttpServer()).post("/auth/register").send({ username: "alice", password: "ExamplePass1!" }).expect(201);
    const login = await request(app.getHttpServer()).post("/auth/login").send({ username: "alice", password: "ExamplePass1!" }).expect(201);
    for (const { body } of [profile, registration, login]) {
      assert.deepEqual(Object.keys(body).sort(), ["id", "username", "createdAt", "suspended"].sort());
      assert.equal(body.id, "user-1");
      assert.ok(!JSON.stringify(body).includes("secret-hash"));
      assert.equal(body.details, undefined);
    }
    assert.ok(login.headers["set-cookie"][0].startsWith("access_token="));
    await request(app.getHttpServer()).get("/user/missing").expect(404);
  });

  it("documents exactly the 14 production operations with summaries, tags, and response schemas", () => {
    const documented = Object.entries(document.paths).flatMap(([path, item]) =>
      Object.keys(item).filter((method) => ["get", "post", "patch", "delete"].includes(method)).map((method) => `${method} ${path}`),
    );
    assert.deepEqual(documented.sort(), routes.map(([method, path]) => `${method} ${path}`).sort());
    const operationIds = new Set();
    for (const [method, path, status] of routes) {
      const operation = document.paths[path][method];
      assert.ok(operation.summary, `${method} ${path} needs a summary`);
      assert.ok(operation.tags.length, `${method} ${path} needs a tag`);
      assert.ok(operation.responses[status]?.content?.["application/json"]?.schema, `${method} ${path} needs a success schema`);
      assert.ok(operation.responses["500"]?.content?.["application/json"]?.schema, `${method} ${path} needs an error schema`);
      assert.ok(!operationIds.has(operation.operationId), "operation IDs must be unique");
      operationIds.add(operation.operationId);
    }
  });

  it("declares bearer authentication on all eight protected operations only", () => {
    assert.equal(document.components.securitySchemes.bearer.type, "http");
    assert.equal(document.components.securitySchemes.bearer.scheme, "bearer");
    for (const [method, path] of routes) {
      const operation = document.paths[path][method];
      const protectedRoute = path.startsWith("/cart") || path.startsWith("/orders") || path === "/checkout";
      if (protectedRoute) {
        assert.deepEqual(operation.security, [{ bearer: [] }]);
        assert.ok(operation.responses["401"]);
        assert.ok(operation.responses["403"]);
      } else {
        assert.deepEqual(operation.security ?? [], []);
      }
    }
  });

  it("documents query and path parameters and validates request schema constraints", () => {
    const query = document.paths["/products"].get.parameters.find((parameter) => parameter.name === "categoryId");
    assert.equal(query.in, "query");
    assert.equal(query.required, false);
    for (const [method, path] of routes) {
      for (const match of path.matchAll(/\{(\w+)\}/g)) {
        const parameter = document.paths[path][method].parameters.find((parameter) => parameter.name === match[1]);
        assert.equal(parameter.in, "path");
        assert.equal(parameter.required, true);
      }
    }
    const schemas = document.components.schemas;
    assert.equal(schemas.AddCartItemDto.properties.quantity.minimum, 1);
    assert.equal(schemas.UpdateCartItemDto.properties.quantity.type, "integer");
    assert.equal(schemas.UserRegistrationDto.properties.password.minLength, 10);
    assert.equal(schemas.UserRegistrationDto.properties.password.writeOnly, true);
    for (const [method, path, schema] of [
      ["post", "/auth/register", "UserRegistrationDto"], ["post", "/auth/login", "UserLoginDto"],
      ["post", "/cart/items", "AddCartItemDto"], ["patch", "/cart/items/{productId}", "UpdateCartItemDto"],
    ]) {
      assert.equal(document.paths[path][method].requestBody.content["application/json"].schema.$ref, `#/components/schemas/${schema}`);
    }
    assert.equal(document.paths["/checkout"].post.requestBody, undefined);
  });

  it("uses public user schemas, nested line schemas, date formats, and structured errors", () => {
    const schemas = document.components.schemas;
    for (const name of ["UserResponseDto", "UserRegisterResponseDto"]) {
      assert.deepEqual(Object.keys(schemas[name].properties).sort(), ["id", "username", "createdAt", "suspended"].sort());
      assert.equal(schemas[name].properties.createdAt.format, "date-time");
    }
    assert.equal(schemas.CartResponseDto.properties.items.items.$ref, "#/components/schemas/CartLineResponseDto");
    assert.equal(schemas.OrderResponseDto.properties.items.items.$ref, "#/components/schemas/OrderItemResponseDto");
    assert.equal(schemas.ProductResponseDto.properties.price.type, "integer");
    assert.equal(schemas.ApiErrorResponseDto.properties.message.oneOf.length, 2);
    assert.ok(schemas.ApiErrorResponseDto.properties.productIds);
    assert.ok(document.paths["/checkout"].post.responses["409"]);
    assert.ok(document.paths["/auth/login"].post.responses["201"].headers["Set-Cookie"]);
  });

  it("resolves every generated schema reference", () => {
    const inspect = (value) => {
      if (!value || typeof value !== "object") return;
      if (typeof value.$ref === "string") {
        assert.ok(value.$ref.startsWith("#/"));
        const target = value.$ref.slice(2).split("/").reduce((node, part) => node?.[part.replaceAll("~1", "/").replaceAll("~0", "~")], document);
        assert.ok(target, `Unresolved reference: ${value.$ref}`);
      }
      Object.values(value).forEach(inspect);
    };
    inspect(document);
  });
});
