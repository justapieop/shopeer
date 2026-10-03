import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderUseCase, type CartItemRepository, type CartRepository, type IdGenerator, type OrderRepository, type ProductRepository } from "@shopeer/case";
import { Cuid2IdGenerator } from "../../common/Cuid2IdGenerator.js";
import { CartModule } from "../cart/Cart.module.js";
import { TypeOrmCartRepository } from "../cart/Cart.repository.js";
import { TypeOrmCartItemRepository } from "../cart/CartItem.repository.js";
import { ProductModule } from "../product/Product.module.js";
import { TypeOrmProductRepository } from "../product/Product.repository.js";
import { OrderController } from "./Order.controller.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "./Order.repository.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]),
    CartModule,
    ProductModule,
  ],
  controllers: [
    OrderController,
  ],
  providers: [
    TypeOrmOrderRepository,
    Cuid2IdGenerator,
    {
      provide: OrderUseCase,
      useFactory: (
        cartRepository: CartRepository,
        cartItemRepository: CartItemRepository,
        productRepository: ProductRepository,
        orderRepository: OrderRepository,
        idGenerator: IdGenerator,
      ) => new OrderUseCase(cartRepository, cartItemRepository, productRepository, orderRepository, idGenerator),
      inject: [
        TypeOrmCartRepository,
        TypeOrmCartItemRepository,
        TypeOrmProductRepository,
        TypeOrmOrderRepository,
        Cuid2IdGenerator,
      ],
    },
  ],
})
export class OrderModule { }
