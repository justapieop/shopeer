import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CartChangedError,
  Order,
  OrderItem,
  OutOfStockError,
} from "@shopeer/domain";
import type { OrderRepository } from "@shopeer/case";
import { paginationOffset, type Pagination } from "@shopeer/case";
import {
  Column,
  Check,
  Entity,
  In,
  PrimaryColumn,
  Repository,
  type EntityManager,
  type UpdateResult,
} from "typeorm";
import { bigintToNumber } from "../../common/transformers.js";
import { requireTransaction } from "../../../database/requireTransaction.js";
import { CartEntity } from "../cart/Cart.repository.js";
import { CartItemEntity } from "../cart/CartItem.repository.js";
import { ProductEntity } from "../product/Product.repository.js";
import { SalesPeriodEntity } from "../product/Sales.repository.js";

@Entity({
  name: "orders",
})
@Check("CHK_orders_status", `"status" IN ('pending', 'completed', 'cancelled')`)
export class OrderEntity {
  @PrimaryColumn({ type: "text" })
  public readonly id!: string;

  @Column({ type: "text", name: "user_id" })
  public readonly userId!: string;

  @Column({ type: "text", name: "cart_id" })
  public readonly cartId!: string;

  @Column({ type: "text", default: "pending" })
  public readonly status!: Order["status"];

  @Column({ type: "bigint", name: "total_amount", transformer: bigintToNumber })
  public readonly totalAmount!: number;

  @Column({ type: "timestamptz", name: "created_at" })
  public readonly createdAt!: Date;
}

@Entity({
  name: "order_items",
})
export class OrderItemEntity {
  @Column({ type: "text", name: "sale_id", nullable: true })
  public readonly saleId!: string | null;
  @Column({ type: "text", name: "seller_id", nullable: true })
  public readonly sellerId!: string | null;
  @Column({ type: "text", name: "product_name", default: "Product" })
  public readonly name!: string;
  @Column({ type: "text", name: "image_url", default: "" })
  public readonly imageUrl!: string;
  @PrimaryColumn({ type: "text" })
  public readonly id!: string;

  @Column({ type: "text", name: "order_id" })
  public readonly orderId!: string;

  @Column({ type: "text", name: "product_id" })
  public readonly productId!: string;

  @Column({ type: "bigint", name: "unit_price", transformer: bigintToNumber })
  public readonly unitPrice!: number;

  @Column({ type: "integer" })
  public readonly quantity!: number;
}

@Injectable()
export class TypeOrmOrderRepository implements OrderRepository {
  public onProductsChanged?: () => void;

  public constructor(
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
  ) {}

  /**
   * Uses the transaction supplied by the Unit of Work. Errors must propagate
   * to its callback so stock, order and cart changes are rolled back together.
   */
  public async placeOrder(order: Order, cartId: string): Promise<void> {
    const manager: EntityManager = this.orderRepository.manager;
    requireTransaction(manager);
    // Always touch products in the same order (sorted by id). Two checkouts
    // sharing several products then wait for each other instead of each
    // holding a lock the other needs (a deadlock).
    const items: OrderItem[] = [...order.items].sort(
      (a: OrderItem, b: OrderItem) =>
        a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
    );

    await ensureCartUnchanged(manager, cartId, items);

    // Conditional updates lock and re-check stock after a competing checkout
    // commits. Read-time stock checks alone cannot prevent overselling.
    const outOfStock: string[] = [];
    for (const item of items) {
      const result: UpdateResult = await manager
        .createQueryBuilder()
        .update(ProductEntity)
        .set({ stock: () => `"stock" - :quantity` })
        .where(`"id" = :productId AND "stock" >= :quantity`, {
          productId: item.productId,
          quantity: item.quantity,
        })
        .andWhere(`"seller_id" IS NOT DISTINCT FROM :sellerId`, { sellerId: item.sellerId })
        .andWhere(`"sale_id" IS NOT DISTINCT FROM :saleId`, { saleId: item.saleId })
        .andWhere(`("sale_ends_at" IS NULL OR "sale_ends_at" > clock_timestamp())`)
        .execute();
      if (result.affected === 0) {
        outOfStock.push(item.productId);
      } else if (item.saleId) {
        const period = await manager.createQueryBuilder().update(SalesPeriodEntity)
          .set({ remaining: () => `"remaining" - :quantity` })
          .where(`"id" = :id AND "remaining" >= :quantity AND "ends_at" > clock_timestamp()`, { id: item.saleId, quantity: item.quantity }).execute();
        if (period.affected !== 1) outOfStock.push(item.productId);
      }
    }

    if (outOfStock.length > 0) {
      throw new OutOfStockError(outOfStock);
    }

    await manager.insert(OrderEntity, toOrderEntity(order));
    await manager.insert(OrderItemEntity, order.items.map(toOrderItemEntity));

    // Remove only the purchased lines. Application additions wait on the parent
    // cart lock and run after checkout commits.
    await manager.delete(CartItemEntity, {
      cartId,
      productId: In(items.map((item: OrderItem) => item.productId)),
    });
    await manager.update(CartEntity, { id: cartId }, { updatedAt: new Date() });
    this.onProductsChanged?.();
  }

  public async fetchOrderById(orderId: string): Promise<Order | null> {
    const entity: OrderEntity | null = await this.orderRepository.findOneBy({
      id: orderId,
    });

    if (!entity) {
      return null;
    }

    const items: OrderItemEntity[] = await this.orderItemRepository.find({
      where: { orderId },
      order: { productId: "ASC" },
    });

    return toDomain(entity, items);
  }

  public async fetchOrdersByUserId(userId: string, pagination: Pagination): Promise<Order[]> {
    const entities: OrderEntity[] = await this.orderRepository.find({
      where: { userId },
      order: { createdAt: "DESC", id: "DESC" },
      skip: paginationOffset(pagination),
      take: pagination.limit,
    });

    if (entities.length === 0) {
      return [];
    }

    const items: OrderItemEntity[] = await this.orderItemRepository.find({
      where: { orderId: In(entities.map((entity: OrderEntity) => entity.id)) },
      order: { productId: "ASC" },
    });

    const itemsByOrder = new Map<string, OrderItemEntity[]>();
    for (const item of items) {
      const group = itemsByOrder.get(item.orderId) ?? [];
      group.push(item);
      itemsByOrder.set(item.orderId, group);
    }
    return entities.map((entity) => toDomain(entity, itemsByOrder.get(entity.id) ?? []));
  }

  public async fetchOrdersBySellerId(sellerId: string, pagination: Pagination): Promise<Order[]> {
    const entities = await this.orderRepository.createQueryBuilder("placed")
      .where(`EXISTS (SELECT 1 FROM "order_items" AS seller_line WHERE seller_line."order_id" = placed."id" AND seller_line."seller_id" = :sellerId)`, { sellerId })
      .orderBy("placed.createdAt", "DESC").addOrderBy("placed.id", "DESC")
      .skip(paginationOffset(pagination)).take(pagination.limit).getMany();
    if (!entities.length) return [];
    const items = await this.orderItemRepository.find({ where: { orderId: In(entities.map((order) => order.id)), sellerId }, order: { productId: "ASC" } });
    return entities.map((order) => toDomain(order, items.filter((item) => item.orderId === order.id)));
  }

  public async fetchOrderBySellerId(sellerId: string, orderId: string): Promise<Order | null> {
    const items = await this.orderItemRepository.find({ where: { orderId, sellerId }, order: { productId: "ASC" } });
    if (!items.length) return null;
    const order = await this.orderRepository.findOneBy({ id: orderId });
    return order ? toDomain(order, items) : null;
  }
}

/**
 * Locks the cart's lines (SELECT … FOR UPDATE) so they cannot change until
 * this transaction ends, then checks they still match what is being ordered.
 * Protects against the cart being edited between reading it and ordering.
 */
async function ensureCartUnchanged(
  manager: EntityManager,
  cartId: string,
  items: OrderItem[],
): Promise<void> {
  const lines: CartItemEntity[] = await manager
    .createQueryBuilder(CartItemEntity, "line")
    .where("line.cartId = :cartId", { cartId })
    .setLock("pessimistic_write")
    .getMany();
  const quantities: Map<string, number> = new Map(
    lines.map((line: CartItemEntity) => [line.productId, line.quantity]),
  );

  if (
    items.some(
      (item: OrderItem) => quantities.get(item.productId) !== item.quantity,
    )
  ) {
    throw new CartChangedError();
  }
}

function toDomain(entity: OrderEntity, items: OrderItemEntity[]): Order {
  return new Order({
    orderId: entity.id,
    cartId: entity.cartId,
    userId: entity.userId,
    createdAt: entity.createdAt,
    status: entity.status,
    items: items.map(
      (item: OrderItemEntity) =>
        new OrderItem({
          orderItemId: item.id,
          orderId: item.orderId,
          productId: item.productId,
          sellerId: item.sellerId,
          saleId: item.saleId,
          name: item.name,
          imageUrl: item.imageUrl,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
        }),
    ),
  });
}

function toOrderEntity(order: Order): OrderEntity {
  return Object.assign(new OrderEntity(), {
    id: order.orderId,
    cartId: order.cartId,
    status: order.status,
    userId: order.userId,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
  });
}

function toOrderItemEntity(item: OrderItem): OrderItemEntity {
  return Object.assign(new OrderItemEntity(), {
    saleId: item.saleId,
    sellerId: item.sellerId,
    name: item.name,
    imageUrl: item.imageUrl,
    id: item.orderItemId,
    orderId: item.orderId,
    productId: item.productId,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  });
}
