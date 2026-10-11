import { Injectable } from "@nestjs/common";
import { InjectDataSource, InjectRepository } from "@nestjs/typeorm";
import {
  CartChangedError,
  Order,
  OrderItem,
  OutOfStockError,
} from "@shopeer/domain";
import type { OrderRepository } from "@shopeer/case";
import {
  Column,
  DataSource,
  Entity,
  In,
  PrimaryColumn,
  Repository,
  type EntityManager,
  type UpdateResult,
} from "typeorm";
import { bigintToNumber } from "../../common/transformers.js";
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(OrderEntity)
    private readonly orderRepository: Repository<OrderEntity>,
    @InjectRepository(OrderItemEntity)
    private readonly orderItemRepository: Repository<OrderItemEntity>,
  ) {}

  /**
   * Everything runs inside ONE database transaction: if any step throws, the
   * transaction is rolled back and nothing is changed (all or nothing).
   */
  public async placeOrder(order: Order, cartId: string): Promise<void> {
    // Always touch products in the same order (sorted by id). Two checkouts
    // sharing several products then wait for each other instead of each
    // holding a lock the other needs (a deadlock).
    const items: OrderItem[] = [...order.items].sort(
      (a: OrderItem, b: OrderItem) =>
        a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
    );

    await this.dataSource.transaction(async (manager: EntityManager) => {
      await ensureCartUnchanged(manager, cartId, items);

      // Reserve stock. Each UPDATE is atomic: Postgres locks the product row,
      // re-checks "stock >= quantity" against the latest committed value, then
      // subtracts. A concurrent checkout of the same product waits for this
      // transaction to finish and then sees the reduced stock. So two buyers
      // can never both take the last unit, and stock never goes below zero.
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
        // Throwing rolls back the stock already taken for the other products.
        throw new OutOfStockError(outOfStock);
      }

      await manager.insert(OrderEntity, toOrderEntity(order));
      await manager.insert(OrderItemEntity, order.items.map(toOrderItemEntity));

      // Only remove the lines that were ordered: anything added to the cart
      // meanwhile (e.g. from another tab) stays in the cart.
      await manager.delete(CartItemEntity, {
        cartId,
        productId: In(items.map((item: OrderItem) => item.productId)),
      });
      await manager.update(
        CartEntity,
        { id: cartId },
        { updatedAt: new Date() },
      );
    });
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
