import { Controller, Get, Inject, Param, Query } from "@nestjs/common";
import { ProductUseCase } from "@shopeer/case";
import type { Category, Product } from "@shopeer/domain";
import { CategoryResponseDto, ProductResponseDto } from "./Product.dto.js";

@Controller("/products")
export class ProductController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
  ) { }

  /** GET /products or GET /products?categoryId=cat-books */
  @Get()
  public async listProducts(@Query("categoryId") categoryId?: string): Promise<ProductResponseDto[]> {
    const products: Product[] = await this.productUseCase.listProducts(categoryId || undefined);
    return products.map(ProductResponseDto.from);
  }

  @Get("/:productId")
  public async getProduct(@Param("productId") productId: string): Promise<ProductResponseDto> {
    return ProductResponseDto.from(await this.productUseCase.getProduct(productId));
  }
}

@Controller("/categories")
export class CategoryController {
  public constructor(
    @Inject(ProductUseCase)
    private readonly productUseCase: ProductUseCase,
  ) { }

  @Get()
  public async listCategories(): Promise<CategoryResponseDto[]> {
    const categories: Category[] = await this.productUseCase.listCategories();
    return categories.map(CategoryResponseDto.from);
  }
}
