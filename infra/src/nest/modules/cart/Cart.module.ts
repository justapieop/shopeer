import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartUseCase, CartItemUseCase, type CartItemRepository, type IdGenerator, type UnitOfWork } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { UnitOfWorkModule } from "../unitOfWork/UnitOfWork.module.js";
import { Cuid2IdGenerator } from "../../common/Cuid2IdGenerator.js";
import { UserModule } from "../user/User.module.js";
import { CartController } from "./Cart.controller.js";
import { CartItemEntity, TypeOrmCartItemRepository } from "./CartItem.repository.js";

@Module({
  imports: [
    UnitOfWorkModule,
    TypeOrmModule.forFeature([CartItemEntity]),
    UserModule,
  ],
  controllers: [
    CartController,
  ],
  providers: [
    TypeOrmCartItemRepository,
    Cuid2IdGenerator,
    {
      provide: CartUseCase,
      useFactory: (
        unitOfWork: UnitOfWork,
        idGenerator: IdGenerator,
      ) => new CartUseCase(unitOfWork, idGenerator),
      inject: [
        TypeOrmUnitOfWork,
        Cuid2IdGenerator,
      ],
    },
    {
      provide: CartItemUseCase,
      useFactory: (unitOfWork: UnitOfWork, items: CartItemRepository) =>
        new CartItemUseCase(unitOfWork, items),
      inject: [TypeOrmUnitOfWork, TypeOrmCartItemRepository],
    },
  ],
  exports: [
    CartUseCase,
    CartItemUseCase,
  ],
})
export class CartModule { }
