import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryUseCase, ProductUseCase } from "@shopeer/case";
import type { CategoryRepository, ProductRepository, UnitOfWork } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { UnitOfWorkModule } from "../unitOfWork/UnitOfWork.module.js";
import { CategoryEntity, TypeOrmCategoryRepository } from "./Category.repository.js";
import { CategoryController, ProductController } from "./Product.controller.js";
import { ProductEntity, TypeOrmProductRepository } from "./Product.repository.js";

@Module({
  imports: [
    UnitOfWorkModule,
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
      provide: CategoryUseCase,
      useFactory: (unitOfWork: UnitOfWork, categories: CategoryRepository) =>
        new CategoryUseCase(unitOfWork, categories),
      inject: [TypeOrmUnitOfWork, TypeOrmCategoryRepository],
    },
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
    CategoryUseCase,
    ProductUseCase,
  ],
})
export class ProductModule { }
