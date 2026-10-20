import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ProductUseCase } from "@shopeer/case";
import type { Category, Product } from "@shopeer/domain";
import { InMemoryCacheManager } from "../../common/cache/InMemoryCacheManager.js";
import { CategoryResponseDto, ProductResponseDto } from "./Product.dto.js";
import { ApiOkResponse, ApiOperation, ApiParam, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";

@Controller("/products")
@ApiTags("Products")
@ApiErrors({ status: 500, description: "An unexpected server error occurred." })
export class ProductController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
    private readonly cacheManager: InMemoryCacheManager,
  ) { }

  /** GET /products or GET /products?categoryId=cat-books */
  @Get()
  @ApiOperation({ summary: "List products", description: "Returns products sorted by name, optionally filtered by category." })
  @ApiQuery({ name: "categoryId", required: false, type: String, description: "Category ID; omit to list every product.", example: "category-1" })
  @ApiOkResponse({ type: [ProductResponseDto] })
  @ApiErrors({ status: 404, description: "The requested category does not exist." })
  public async listProducts(@Query("categoryId") categoryId?: string): Promise<ProductResponseDto[]> {
    const key: string = categoryId ? `category:${categoryId}` : "all";
    return this.cacheManager.getOrLoad("catalog:products", key, async () => {
      const products: Product[] = await this.productUseCase.listProducts(categoryId || undefined);
      return products.map(ProductResponseDto.from);
    });
  }

  @Get("/:productId")
  @ApiOperation({ summary: "Get a product" })
  @ApiParam({ name: "productId", type: String, example: "product-1" })
  @ApiOkResponse({ type: ProductResponseDto })
  @ApiErrors({ status: 404, description: "The product does not exist." })
  public async getProduct(@Param("productId") productId: string): Promise<ProductResponseDto> {
    return this.cacheManager.getOrLoad("catalog:products", `id:${productId}`, async () =>
      ProductResponseDto.from(await this.productUseCase.getProduct(productId)),
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
    private readonly cacheManager: InMemoryCacheManager,
  ) { }

  @Get()
  @ApiOperation({ summary: "List categories", description: "Returns all categories sorted by name." })
  @ApiOkResponse({ type: [CategoryResponseDto] })
  public async listCategories(): Promise<CategoryResponseDto[]> {
    return this.cacheManager.getOrLoad("catalog:categories", "all", async () => {
      const categories: Category[] = await this.productUseCase.listCategories();
      return categories.map(CategoryResponseDto.from);
    });
  }
}
