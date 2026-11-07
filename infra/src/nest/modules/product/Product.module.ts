import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CategoryUseCase, ProductUseCase, ProductOwnershipUseCase } from "@shopeer/case";
import type { CategoryRepository, ProductRepository, UnitOfWork } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { UnitOfWorkModule } from "../unitOfWork/UnitOfWork.module.js";
import { CategoryEntity, TypeOrmCategoryRepository } from "./Category.repository.js";
import { CategoryController, ProductController } from "./Product.controller.js";
import { ProductEntity, TypeOrmProductRepository } from "./Product.repository.js";
import { ProductOwnershipController } from "./ProductOwnership.controller.js";
import { PermissionsModule } from "../permissions/Permissions.module.js";

@Module({
  imports: [
    UnitOfWorkModule,
    PermissionsModule,
    TypeOrmModule.forFeature([ProductEntity, CategoryEntity]),
  ],
  controllers: [
    ProductController,
    ProductOwnershipController,
    CategoryController,
  ],
  providers: [
    TypeOrmProductRepository,
    { provide: ProductOwnershipUseCase, useFactory: (work: UnitOfWork) => new ProductOwnershipUseCase(work), inject: [TypeOrmUnitOfWork] },
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
