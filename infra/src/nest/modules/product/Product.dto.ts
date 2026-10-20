import type { Category, Product } from "@shopeer/domain";
import { ApiProperty } from "@nestjs/swagger";

export class ProductResponseDto {
  @ApiProperty({ type: String, example: "product-1" })
  public readonly productId!: string;
  @ApiProperty({ type: String, example: "Notebook" })
  public readonly name!: string;
  @ApiProperty({ type: String, example: "A lined notebook." })
  public readonly description!: string;
  @ApiProperty({ type: "integer", format: "int64", minimum: 1, description: "Price per unit in VND.", example: 25000 })
  public readonly price!: number;
  @ApiProperty({ type: String, example: "category-1" })
  public readonly categoryId!: string;
  @ApiProperty({ type: "integer", minimum: 0, example: 10 })
  public readonly stock!: number;
  @ApiProperty({ type: String, example: "https://example.com/notebook.jpg" })
  public readonly imageUrl!: string;

  public static from(product: Product): ProductResponseDto {
    return {
      productId: product.productId,
      name: product.name,
      description: product.description,
      price: product.price,
      categoryId: product.categoryId,
      stock: product.stock,
      imageUrl: product.imageUrl,
    };
  }
}

export class CategoryResponseDto {
  @ApiProperty({ type: String, example: "category-1" })
  public readonly categoryId!: string;
  @ApiProperty({ type: String, example: "Stationery" })
  public readonly name!: string;

  public static from(category: Category): CategoryResponseDto {
    return {
      categoryId: category.categoryId,
      name: category.name,
    };
  }
}
