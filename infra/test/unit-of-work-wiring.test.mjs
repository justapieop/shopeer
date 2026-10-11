import "reflect-metadata";
import assert from "node:assert/strict";
import { it } from "node:test";
import { Global, Module } from "@nestjs/common";
import { MODULE_METADATA } from "@nestjs/common/constants.js";
import { ConfigModule } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { DataSource } from "typeorm";
import { CartUseCase, CartItemUseCase, CategoryUseCase, OrderUseCase, ProductUseCase, UserUseCase } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../dist/database/TypeOrmUnitOfWork.js";
import { OrderModule } from "../dist/nest/modules/order/Order.module.js";
import { CartModule } from "../dist/nest/modules/cart/Cart.module.js";
import { ProductModule } from "../dist/nest/modules/product/Product.module.js";
import { UserModule } from "../dist/nest/modules/user/User.module.js";
import { AuthModule } from "../dist/nest/modules/auth/Auth.module.js";
import { UserPipe } from "../dist/nest/common/decorators/User.decorator.js";

it("feature modules expose use cases and authentication without exporting database adapters", () => {
  for (const [module, expected] of [
    [CartModule, [CartUseCase, CartItemUseCase]],
    [ProductModule, [CategoryUseCase, ProductUseCase]],
    [OrderModule, [OrderUseCase]],
    [UserModule, [UserPipe, UserUseCase]],
  ]) {
    assert.deepEqual(Reflect.getMetadata(MODULE_METADATA.EXPORTS, module), expected);
  }
});

it("shares one Unit of Work provider across all application write use cases", async () => {
  // Construct the dependency graph without opening a database connection.
  const database = new DataSource({ type: "postgres" });
  class TestDatabaseModule {}
  Global()(TestDatabaseModule);
  Module({ providers: [{ provide: DataSource, useValue: database }], exports: [DataSource] })(TestDatabaseModule);
  const module = await Test.createTestingModule({
    imports: [ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }), TestDatabaseModule, AuthModule, CartModule, ProductModule, OrderModule],
  }).compile();
  try {
    const unitOfWork = module.get(TypeOrmUnitOfWork);
    for (const UseCase of [CartUseCase, CartItemUseCase, CategoryUseCase, OrderUseCase, UserUseCase]) {
      assert.equal(module.get(UseCase).unitOfWork, unitOfWork);
    }
  } finally {
    await module.close();
  }
});
