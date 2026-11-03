import type { Order, OrderItem } from "@shopeer/domain";
import { ApiProperty } from "@nestjs/swagger";

export class OrderItemResponseDto {
  @ApiProperty({ type: String, example: "product-1" })
  public readonly productId!: string;
  @ApiProperty({ type: "integer", format: "int64", description: "Unit price at purchase time, in VND.", example: 25000 })
  public readonly unitPrice!: number;
  @ApiProperty({ type: "integer", minimum: 1, example: 2 })
  public readonly quantity!: number;
  @ApiProperty({ type: "integer", format: "int64", description: "Line total in VND.", example: 50000 })
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
  @ApiProperty({ type: String, example: "order-1" })
  public readonly orderId!: string;
  @ApiProperty({ type: String, format: "date-time", example: "2026-10-20T08:00:00.000Z" })
  public readonly createdAt!: Date;
  @ApiProperty({ type: "integer", format: "int64", description: "Order total in VND.", example: 50000 })
  public readonly totalAmount!: number;
  @ApiProperty({ type: () => OrderItemResponseDto, isArray: true })
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
