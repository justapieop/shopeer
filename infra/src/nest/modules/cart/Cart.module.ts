import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartUseCase, type CartItemRepository, type CartRepository, type IdGenerator, type ProductRepository, type UserRepository } from "@shopeer/case";
import { Cuid2IdGenerator } from "../../common/Cuid2IdGenerator.js";
import { TypeOrmProductRepository } from "../product/Product.repository.js";
import { ProductModule } from "../product/Product.module.js";
import { TypeOrmUserRepository } from "../user/User.repository.js";
import { UserModule } from "../user/User.module.js";
import { CartController } from "./Cart.controller.js";
import { CartEntity, TypeOrmCartRepository } from "./Cart.repository.js";
import { CartItemEntity, TypeOrmCartItemRepository } from "./CartItem.repository.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([CartEntity, CartItemEntity]),
    ProductModule,
    UserModule,
  ],
  controllers: [
    CartController,
  ],
  providers: [
    TypeOrmCartRepository,
    TypeOrmCartItemRepository,
    Cuid2IdGenerator,
    {
      provide: CartUseCase,
      useFactory: (
        cartRepository: CartRepository,
        cartItemRepository: CartItemRepository,
        productRepository: ProductRepository,
        userRepository: UserRepository,
        idGenerator: IdGenerator,
      ) => new CartUseCase(cartRepository, cartItemRepository, productRepository, userRepository, idGenerator),
      inject: [
        TypeOrmCartRepository,
        TypeOrmCartItemRepository,
        TypeOrmProductRepository,
        TypeOrmUserRepository,
        Cuid2IdGenerator,
      ],
    },
  ],
  exports: [
    TypeOrmCartRepository,
    TypeOrmCartItemRepository,
  ],
})
export class CartModule { }
