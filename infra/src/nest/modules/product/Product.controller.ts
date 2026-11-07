import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
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
import { PaginationQueryDto } from "../../common/Pagination.dto.js";

@Controller("/products")
@ApiTags("Products")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class ProductController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
    @Inject(InMemoryCacheManager)
    private readonly cacheManager: InMemoryCacheManager,
  ) {}

  /** GET /products or GET /products?categoryId=cat-books */
  @Get()
  @ApiOperation({ summary: "List products", description: "Returns a page of products sorted by name then ID, optionally filtered by category. Defaults to page 1 with 20 results; maximum limit is 100." })
  @ApiQuery({ name: "categoryId", required: false, type: String, description: "Category ID; omit to list every product.", example: "category-1" })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @ApiErrors({ status: 404, description: "The requested category does not exist." })
  @ApiErrors({ status: 400, description: "Invalid pagination parameters." })
  public async listProducts(@Query() pagination: PaginationQueryDto, @Query("categoryId") categoryId?: string): Promise<ProductResponseDto[]> {
    const key = JSON.stringify([categoryId || null, pagination.page, pagination.limit]);
    // Cache serializable snapshots; class methods and Date objects may not survive the cache store.
    const products = await this.cacheManager.getOrLoad("catalog:products", key, async () =>
      (await this.productUseCase.listProducts(categoryId || undefined, pagination)).map((product) => ({
        response: ProductResponseDto.from(product), endsAt: product.saleEndsAt?.toISOString() ?? null,
      })));
    return products.map(({ response, endsAt }) => endsAt && Date.parse(endsAt) <= Date.now()
      ? { ...response, stock: 0 } : response);
  }

  @Get("/:productId")
  @ApiOperation({ summary: "Get a product" })
  @ApiParam({ name: "productId", type: String, example: "product-1" })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrors({ status: 404, description: "The product does not exist." })
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
