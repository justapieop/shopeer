import {
  NotFoundError,
  type Category,
  type CategoryRepository,
  type Product,
  type ProductRepository,
} from "@shopeer/domain";

export class ProductUseCase {
  public constructor(
    private readonly productRepository: ProductRepository,
    private readonly categoryRepository: CategoryRepository,
  ) { }

  /** Lists every product, or only those of one category when `categoryId` is given. */
  public async listProducts(categoryId?: string): Promise<Product[]> {
    if (categoryId === undefined) {
      return await this.productRepository.fetchAllProducts();
    }

    const category: Category | null = await this.categoryRepository.fetchCategoryById(categoryId);

    if (!category) {
      throw new NotFoundError(`Category ${categoryId} not found`);
    }

    return await this.productRepository.fetchProductsByCategory(categoryId);
  }

  public async getProduct(productId: string): Promise<Product> {
    const product: Product | null = await this.productRepository.fetchProductById(productId);

    if (!product) {
      throw new NotFoundError(`Product ${productId} not found`);
    }

    return product;
  }

  public async listCategories(): Promise<Category[]> {
    return await this.categoryRepository.fetchAllCategories();
  }
}
