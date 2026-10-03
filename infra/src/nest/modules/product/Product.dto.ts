import type { Category, Product } from "@shopeer/domain";

export class ProductResponseDto {
  public readonly productId!: string;
  public readonly name!: string;
  public readonly description!: string;
  public readonly price!: number;
  public readonly categoryId!: string;
  public readonly stock!: number;
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
  public readonly categoryId!: string;
  public readonly name!: string;

  public static from(category: Category): CategoryResponseDto {
    return {
      categoryId: category.categoryId,
      name: category.name,
    };
  }
}
