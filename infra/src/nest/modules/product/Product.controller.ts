import { Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ProductUseCase } from "@shopeer/case";
import type { Category, Product } from "@shopeer/domain";
import { InMemoryCacheManager } from "../../common/cache/InMemoryCacheManager.js";
import { CategoryResponseDto, ProductResponseDto } from "./Product.dto.js";
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";

@Controller("/products")
@ApiTags("Products")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class ProductController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
  ) {}

  /** GET /products or GET /products?categoryId=cat-books */
  @Get()
  public async listProducts(
    @Query("categoryId") categoryId?: string,
  ): Promise<ProductResponseDto[]> {
    const products: Product[] = await this.productUseCase.listProducts(
      categoryId || undefined,
    );
    return products.map(ProductResponseDto.from);
  }

  @Get("/:productId")
  public async getProduct(
    @Param("productId") productId: string,
  ): Promise<ProductResponseDto> {
    return ProductResponseDto.from(
      await this.productUseCase.getProduct(productId),
    );
  }
}

@Controller("/categories")
@ApiTags("Categories")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class CategoryController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
    @Inject(InMemoryCacheManager)
    private readonly cacheManager: InMemoryCacheManager,
  ) {}

  @Get()
  @ApiOperation({
    summary: "List categories",
    description: "Returns all categories sorted by name.",
  })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  public async listCategories(): Promise<CategoryResponseDto[]> {
    return this.cacheManager.getOrLoad(
      "catalog:categories",
      "all",
      async () => {
        const categories: Category[] =
          await this.productUseCase.listCategories();
        return categories.map(CategoryResponseDto.from);
      },
    );
  }
}
