import { Injectable } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { RepositorySet, UnitOfWork } from "@shopeer/case";
import { DataSource } from "typeorm";
import { CartEntity, TypeOrmCartRepository } from "../nest/modules/cart/Cart.repository.js";
import { CartItemEntity, TypeOrmCartItemRepository } from "../nest/modules/cart/CartItem.repository.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "../nest/modules/order/Order.repository.js";
import { ProductEntity, TypeOrmProductRepository } from "../nest/modules/product/Product.repository.js";
import { CategoryEntity, TypeOrmCategoryRepository } from "../nest/modules/product/Category.repository.js";
import { UserEntity, TypeOrmUserRepository } from "../nest/modules/user/User.repository.js";

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  public constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  public execute<T>(work: (repositories: RepositorySet) => Promise<T>): Promise<T> {
    return this.dataSource.transaction(async (manager) => {
      // Create a fresh set per execution. Every adapter uses this manager,
      // including raw SQL and the multi-table placeOrder operation.
      const repositories: RepositorySet = {
        carts: new TypeOrmCartRepository(manager.getRepository(CartEntity)),
        cartItems: new TypeOrmCartItemRepository(manager.getRepository(CartItemEntity)),
        products: new TypeOrmProductRepository(manager.getRepository(ProductEntity)),
        users: new TypeOrmUserRepository(manager.getRepository(UserEntity)),
        categories: new TypeOrmCategoryRepository(manager.getRepository(CategoryEntity)),
        orders: new TypeOrmOrderRepository(
          manager.getRepository(OrderEntity),
          manager.getRepository(OrderItemEntity),
        ),
      };
      return work(repositories);
    });
  }
}
