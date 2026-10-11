import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { CartEntity } from "../cart/Cart.repository.js";
import { CartItemEntity } from "../cart/CartItem.repository.js";
import { OrderEntity, OrderItemEntity } from "../order/Order.repository.js";
import { CategoryEntity } from "../product/Category.repository.js";
import { ProductEntity } from "../product/Product.repository.js";
import { UserEntity } from "../user/User.repository.js";

@Module({
  imports: [TypeOrmModule.forFeature([
    CartEntity, CartItemEntity, OrderEntity, OrderItemEntity,
    ProductEntity, CategoryEntity, UserEntity,
  ])],
  providers: [TypeOrmUnitOfWork],
  exports: [TypeOrmUnitOfWork],
})
export class UnitOfWorkModule {}
