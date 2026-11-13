import { ConflictError, InvalidParametersError, NotFoundError } from "@shopeer/domain";
import { paginationOffset, type Pagination, type SalesPeriod, type SalesRepository, type SellerProduct } from "@shopeer/case";
import { Column, Entity, PrimaryColumn, type EntityManager } from "typeorm";
import { requireTransaction } from "../../../database/requireTransaction.js";
import { ProductEntity } from "./Product.repository.js";

@Entity({ name: "sales_periods" })
export class SalesPeriodEntity implements SalesPeriod {
  @PrimaryColumn({ type: "text" }) id!: string;
  @Column({ type: "text", name: "product_id" }) productId!: string;
  @Column({ type: "integer" }) quantity!: number;
  @Column({ type: "integer" }) remaining!: number;
  @Column({ type: "integer", name: "additional_stock" }) additionalStock!: number;
  @Column({ type: "timestamptz", name: "starts_at" }) startsAt!: Date;
  @Column({ type: "timestamptz", name: "ends_at" }) endsAt!: Date;
}

export class TypeOrmSalesRepository implements SalesRepository {
  constructor(private readonly manager: EntityManager, private readonly onSaved: () => void) {}

  async publish(sellerId: string, productId: string, id: string, additionalStock: number, endsAt: Date): Promise<SalesPeriod> {
    requireTransaction(this.manager);
    const product = await this.manager.getRepository(ProductEntity).createQueryBuilder("product")
      .where("product.id = :productId AND product.sellerId = :sellerId", { productId, sellerId })
      .setLock("pessimistic_write").getOne();
    if (!product) throw new NotFoundError("Product not found");
    // Read the clock after the lock: a checkout or another publication may have made us wait.
    const [{ now }] = await this.manager.query(`SELECT clock_timestamp() AS now`);
    if (product.saleEndsAt && product.saleEndsAt > now && product.stock > 0) throw new ConflictError("The current sales period has not ended");
    if (endsAt <= now) throw new InvalidParametersError("End date must be in the future");
    const quantity = product.stock + additionalStock;
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 2_147_483_647) throw new InvalidParametersError("Total quantity must be between 1 and 2147483647");
    const period = { id, productId, quantity, remaining: quantity, additionalStock, startsAt: now as Date, endsAt };
    await this.manager.insert(SalesPeriodEntity, period);
    await this.manager.update(ProductEntity, { id: productId }, { stock: quantity, saleId: id, saleEndsAt: endsAt });
    this.onSaved();
    return period;
  }

  async list(sellerId: string, pagination: Pagination): Promise<SellerProduct[]> {
    const products = await this.manager.find(ProductEntity, { where: { sellerId }, order: { name: "ASC", id: "ASC" }, skip: paginationOffset(pagination), take: pagination.limit });
    return Promise.all(products.map(async (product) => ({ productId: product.id, name: product.name, price: product.price, stock: product.stock,
      periods: await this.manager.find(SalesPeriodEntity, { where: { productId: product.id }, order: { startsAt: "DESC", id: "DESC" }, take: 20 }),
    })));
  }
}
