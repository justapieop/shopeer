import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProductUseCase } from "@shopeer/case";
import type { CategoryRepository, ProductRepository } from "@shopeer/domain";
import { CategoryEntity, TypeOrmCategoryRepository } from "./Category.repository.js";
import { CategoryController, ProductController } from "./Product.controller.js";
import { ProductEntity, TypeOrmProductRepository } from "./Product.repository.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([ProductEntity, CategoryEntity]),
  ],
  controllers: [
    ProductController,
    CategoryController,
  ],
  providers: [
    TypeOrmProductRepository,
    TypeOrmCategoryRepository,
    {
      provide: ProductUseCase,
      useFactory: (productRepository: ProductRepository, categoryRepository: CategoryRepository) =>
        new ProductUseCase(productRepository, categoryRepository),
      inject: [
        TypeOrmProductRepository,
        TypeOrmCategoryRepository,
      ],
    },
  ],
  exports: [
    TypeOrmProductRepository,
  ],
})
export class ProductModule { }
