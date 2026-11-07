import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { ConflictError, Product } from "@shopeer/domain";
import type { ProductRepository } from "@shopeer/case";
import { paginationOffset, type Pagination } from "@shopeer/case";
import { Column, Entity, In, PrimaryColumn, Repository } from "typeorm";
import { bigintToNumber } from "../../common/transformers.js";
import { requireTransaction } from "../../../database/requireTransaction.js";

@Entity({
  name: "products",
})
export class ProductEntity {
  @Column({ type: "text", name: "sale_id", nullable: true })
  public readonly saleId!: string | null;
  @Column({ type: "timestamptz", name: "sale_ends_at", nullable: true })
  public readonly saleEndsAt!: Date | null;
  @Column({ type: "text", name: "seller_id", nullable: true })
  public readonly sellerId!: string | null;
  @PrimaryColumn({ type: "text", })
  public readonly id!: string;

  @Column({ type: "text", })
  public readonly name!: string;

  @Column({ type: "text", })
  public readonly description!: string;

  @Column({ type: "bigint", transformer: bigintToNumber, })
  public readonly price!: number;

  @Column({ type: "text", name: "category_id", })
  public readonly categoryId!: string;

  @Column({ type: "integer", })
  public readonly stock!: number;

  @Column({ type: "text", name: "image_url", })
  public readonly imageUrl!: string;
}

@Injectable()
export class TypeOrmProductRepository implements ProductRepository {
  /** Set by the unit of work to invalidate catalog reads after commit. */
  public onSaved?: () => void;

  public constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) { }

  public async save(product: Product): Promise<Product> {
    requireTransaction(this.productRepository.manager);
    const current = await this.productRepository.findOne({ where: { id: product.productId }, lock: { mode: "pessimistic_write" } });
    if (current?.saleId) throw new ConflictError("Published products cannot be edited; create a new sales period to add stock");
    const entity: ProductEntity = await this.productRepository.save(toEntity(product));
    this.onSaved?.();
    return toDomain(entity);
  }

  public async assignSeller(productId: string, sellerId: string): Promise<boolean> {
    requireTransaction(this.productRepository.manager);
    const current = await this.productRepository.findOne({ where: { id: productId }, lock: { mode: "pessimistic_write" } });
    if (current?.saleId) throw new ConflictError("A published product cannot be reassigned");
    const result = await this.productRepository.update({ id: productId }, { sellerId });
    if (result.affected) this.onSaved?.();
    return (result.affected ?? 0) > 0;
  }

  public async fetchProductById(productId: string): Promise<Product | null> {
    const entity: ProductEntity | null = await this.productRepository.findOneBy({ id: productId, });
    return entity ? toDomain(entity) : null;
  }

  public async fetchProductsByIds(productIds: string[]): Promise<Product[]> {
    if (productIds.length === 0) {
      return [];
    }

    const entities: ProductEntity[] = await this.productRepository.findBy({ id: In(productIds), });
    return entities.map(toDomain);
  }

  public async fetchAllProducts(pagination: Pagination): Promise<Product[]> {
    const entities: ProductEntity[] = await this.productRepository.find({ order: { name: "ASC", id: "ASC" }, skip: paginationOffset(pagination), take: pagination.limit });
    return entities.map(toDomain);
  }

  public async fetchProductsByCategory(categoryId: string, pagination: Pagination): Promise<Product[]> {
    const entities: ProductEntity[] = await this.productRepository.find({
      where: { categoryId, },
      order: { name: "ASC", id: "ASC" },
      skip: paginationOffset(pagination),
      take: pagination.limit,
    });
    return entities.map(toDomain);
  }
}

function toDomain(entity: ProductEntity): Product {
  return new Product({
    saleId: entity.saleId,
    saleEndsAt: entity.saleEndsAt,
    sellerId: entity.sellerId,
    productId: entity.id,
    name: entity.name,
    description: entity.description,
    price: entity.price,
    categoryId: entity.categoryId,
    stock: entity.saleEndsAt && entity.saleEndsAt.getTime() <= Date.now() ? 0 : entity.stock,
    imageUrl: entity.imageUrl,
  });
}

function toEntity(product: Product): ProductEntity {
  return Object.assign(new ProductEntity(), {
    saleId: product.saleId,
    saleEndsAt: product.saleEndsAt,
    sellerId: product.sellerId,
    id: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    stock: product.stock,
    imageUrl: product.imageUrl,
  });
}
