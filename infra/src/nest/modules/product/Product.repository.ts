import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Product, type ProductRepository } from "@shopeer/domain";
import { Column, Entity, In, PrimaryColumn, Repository } from "typeorm";
import { bigintToNumber } from "../../common/transformers.js";

@Entity({
  name: "products",
})
export class ProductEntity {
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
  public constructor(
    @InjectRepository(ProductEntity)
    private readonly productRepository: Repository<ProductEntity>,
  ) { }

  public async save(product: Product): Promise<Product> {
    return toDomain(await this.productRepository.save(toEntity(product)));
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

  public async fetchAllProducts(): Promise<Product[]> {
    const entities: ProductEntity[] = await this.productRepository.find({ order: { name: "ASC", }, });
    return entities.map(toDomain);
  }

  public async fetchProductsByCategory(categoryId: string): Promise<Product[]> {
    const entities: ProductEntity[] = await this.productRepository.find({
      where: { categoryId, },
      order: { name: "ASC", },
    });
    return entities.map(toDomain);
  }
}

function toDomain(entity: ProductEntity): Product {
  return new Product({
    productId: entity.id,
    name: entity.name,
    description: entity.description,
    price: entity.price,
    categoryId: entity.categoryId,
    stock: entity.stock,
    imageUrl: entity.imageUrl,
  });
}

function toEntity(product: Product): ProductEntity {
  return Object.assign(new ProductEntity(), {
    id: product.productId,
    name: product.name,
    description: product.description,
    price: product.price,
    categoryId: product.categoryId,
    stock: product.stock,
    imageUrl: product.imageUrl,
  });
}
