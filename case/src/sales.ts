import { InvalidParametersError, NotFoundError, Product, type ProductDetails } from "@shopeer/domain";
import type { IdGenerator, RepositorySet, UnitOfWork } from "./ports.js";
import { paginationOffset, type Pagination } from "./pagination.js";

export interface SalesPeriod {
  id: string;
  productId: string;
  quantity: number;
  remaining: number;
  additionalStock: number;
  startsAt: Date;
  endsAt: Date;
}
export interface SellerProduct {
  productId: string;
  name: string;
  price: number;
  stock: number;
  periods: SalesPeriod[];
}
export interface SalesRepository {
  /** Lock the product, verify ownership, reject replacing an active period with unsold stock, and carry remaining stock forward. */
  publish(sellerId: string, productId: string, id: string, additionalStock: number, endsAt: Date): Promise<SalesPeriod>;
  list(sellerId: string, pagination: Pagination): Promise<SellerProduct[]>;
}
export type SalesRepositories = RepositorySet & { sales: SalesRepository };

export class SalesUseCase {
  constructor(private readonly work: UnitOfWork<SalesRepositories>, private readonly ids: IdGenerator) {}

  async list(sellerId: string, pagination: Pagination): Promise<SellerProduct[]> {
    paginationOffset(pagination);
    return this.work.execute(({ sales }) => sales.list(sellerId, pagination));
  }

  async create(sellerId: string, input: Omit<ProductDetails, "productId" | "sellerId">, endsAt: Date): Promise<SalesPeriod> {
    this.validate(input.stock, endsAt);
    if (!input.stock) throw new InvalidParametersError("Quantity must be positive");
    const product = new Product({ ...input, productId: this.ids.generate(), sellerId });
    return this.work.execute(async ({ products, categories, sales }) => {
      if (!await categories.fetchCategoryById(product.categoryId)) throw new NotFoundError("Category not found");
      await products.save(product);
      return sales.publish(sellerId, product.productId, this.ids.generate(), 0, endsAt);
    });
  }

  async publish(sellerId: string, productId: string, additionalStock: number, endsAt: Date): Promise<SalesPeriod> {
    this.validate(additionalStock, endsAt);
    return this.work.execute(({ sales }) => sales.publish(sellerId, productId, this.ids.generate(), additionalStock, endsAt));
  }

  private validate(stock: number, endsAt: Date): void {
    if (!Number.isSafeInteger(stock) || stock < 0 || stock > 2_147_483_647) throw new InvalidParametersError("Stock must be a non-negative integer up to 2147483647");
    if (!Number.isFinite(endsAt.getTime()) || endsAt.getTime() <= Date.now()) throw new InvalidParametersError("End date must be in the future");
  }
}
