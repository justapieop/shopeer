import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import {
  CartChangedError,
  Order,
  OrderItem,
  OutOfStockError,
} from "@shopeer/domain";
import type { OrderRepository } from "@shopeer/case";
import {
  Column,
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

@Entity({
  name: "orders",
})
export class OrderEntity {
  @PrimaryColumn({ type: "text" })
  public readonly id!: string;

  @Column({ type: "text", name: "user_id" })
  public readonly userId!: string;

  @Column({ type: "text", name: "cart_id" })
  public readonly cartId!: string;

  @Column({ type: "bigint", name: "total_amount", transformer: bigintToNumber })
  public readonly totalAmount!: number;

  @Column({ type: "timestamptz", name: "created_at" })
  public readonly createdAt!: Date;
}

@Entity({
  name: "order_items",
})
export class OrderItemEntity {
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
        .execute();
      if (result.affected === 0) {
        outOfStock.push(item.productId);
      }
    }

    if (outOfStock.length > 0) {
      throw new OutOfStockError(outOfStock);
    }

    await manager.insert(OrderEntity, toOrderEntity(order));
    await manager.insert(OrderItemEntity, order.items.map(toOrderItemEntity));

    // New products added during checkout remain in the cart.
    await manager.delete(CartItemEntity, {
      cartId,
      productId: In(items.map((item: OrderItem) => item.productId)),
    });
    await manager.update(CartEntity, { id: cartId }, { updatedAt: new Date() });
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

  public async fetchOrdersByUserId(userId: string): Promise<Order[]> {
    const entities: OrderEntity[] = await this.orderRepository.find({
      where: { userId },
      order: { createdAt: "DESC" },
    });

    if (entities.length === 0) {
      return [];
    }

    const items: OrderItemEntity[] = await this.orderItemRepository.find({
      where: { orderId: In(entities.map((entity: OrderEntity) => entity.id)) },
      order: { productId: "ASC" },
    });

    return entities.map((entity: OrderEntity) =>
      toDomain(
        entity,
        items.filter((item: OrderItemEntity) => item.orderId === entity.id),
      ),
    );
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
    status: "completed",
    items: items.map(
      (item: OrderItemEntity) =>
        new OrderItem({
          orderItemId: item.id,
          orderId: item.orderId,
          productId: item.productId,
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
    userId: order.userId,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt,
  });
}

function toOrderItemEntity(item: OrderItem): OrderItemEntity {
  return Object.assign(new OrderItemEntity(), {
    id: item.orderItemId,
    orderId: item.orderId,
    productId: item.productId,
    unitPrice: item.unitPrice,
    quantity: item.quantity,
  });
}
