import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { OrderUseCase } from "@shopeer/case";
import type { Order } from "@shopeer/domain";
import { CurrentUserId } from "../../common/decorators/CurrentUserId.decorator.js";
import { OrderResponseDto } from "./Order.dto.js";

@Controller()
export class OrderController {
  public constructor(
    @Inject(OrderUseCase)
    private readonly orderUseCase: OrderUseCase,
  ) { }

  /** Turns the current user's cart into an order. 201 Created on success. */
  @Post("/checkout")
  public async checkout(@CurrentUserId() userId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.checkout(userId));
  }

  @Get("/orders")
  public async listOrders(@CurrentUserId() userId: string): Promise<OrderResponseDto[]> {
    const orders: Order[] = await this.orderUseCase.listOrders(userId);
    return orders.map(OrderResponseDto.from);
  }

  @Get("/orders/:orderId")
  public async getOrder(@CurrentUserId() userId: string, @Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.getOrder(userId, orderId));
  }
}
