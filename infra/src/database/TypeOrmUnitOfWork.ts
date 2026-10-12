import { Inject, Injectable, Optional } from "@nestjs/common";
import { InjectDataSource } from "@nestjs/typeorm";
import type { RepositorySet, UnitOfWork } from "@shopeer/case";
import { DataSource } from "typeorm";
import { CartEntity, TypeOrmCartRepository } from "../nest/modules/cart/Cart.repository.js";
import { CartItemEntity, TypeOrmCartItemRepository } from "../nest/modules/cart/CartItem.repository.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "../nest/modules/order/Order.repository.js";
import { ProductEntity, TypeOrmProductRepository } from "../nest/modules/product/Product.repository.js";
import { CategoryEntity, TypeOrmCategoryRepository } from "../nest/modules/product/Category.repository.js";
import { UserEntity, TypeOrmUserRepository } from "../nest/modules/user/User.repository.js";
import { InMemoryCacheManager } from "../nest/common/cache/InMemoryCacheManager.js";

@Injectable()
export class TypeOrmUnitOfWork implements UnitOfWork {
  public constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Optional()
    @Inject(InMemoryCacheManager)
    private readonly cacheManager?: InMemoryCacheManager,
  ) {}

  public async execute<T>(work: (repositories: RepositorySet) => Promise<T>): Promise<T> {
    let productsChanged: boolean = false;
    let categoriesChanged: boolean = false;

    const result: T = await this.dataSource.transaction(async (manager) => {
      const products = new TypeOrmProductRepository(manager.getRepository(ProductEntity));
      products.onSaved = () => { productsChanged = true; };
      const categories = new TypeOrmCategoryRepository(manager.getRepository(CategoryEntity));
      categories.onSaved = () => { categoriesChanged = true; };
      const orders = new TypeOrmOrderRepository(
        manager.getRepository(OrderEntity),
        manager.getRepository(OrderItemEntity),
      );
      orders.onProductsChanged = () => { productsChanged = true; };

      const repositories: RepositorySet = {
        carts: new TypeOrmCartRepository(manager.getRepository(CartEntity)),
        cartItems: new TypeOrmCartItemRepository(manager.getRepository(CartItemEntity)),
        products,
        users: new TypeOrmUserRepository(manager.getRepository(UserEntity)),
        categories,
        orders,
      };
      return work(repositories);
    });

    if (productsChanged) {
      this.cacheManager?.invalidateProducts();
    }
    if (categoriesChanged) {
      this.cacheManager?.invalidateCategories();
    }

    return result;
  }
}
