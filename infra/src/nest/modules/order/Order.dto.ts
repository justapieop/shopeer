import type { Order, OrderItem } from "@shopeer/domain";

export class OrderItemResponseDto {
  public readonly productId!: string;
  public readonly unitPrice!: number;
  public readonly quantity!: number;
  public readonly subtotal!: number;

  public static from(item: OrderItem): OrderItemResponseDto {
    return {
      productId: item.productId,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      subtotal: item.subtotal,
    };
  }
}

export class OrderResponseDto {
  public readonly orderId!: string;
  public readonly createdAt!: Date;
  public readonly totalAmount!: number;
  public readonly items!: OrderItemResponseDto[];

  public static from(order: Order): OrderResponseDto {
    return {
      orderId: order.orderId,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      items: order.items.map(OrderItemResponseDto.from),
    };
  }
}
