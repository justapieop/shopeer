import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { OrderUseCase } from "@shopeer/case";
import type { Order } from "@shopeer/domain";
import type { User as DomainUser } from "@shopeer/domain";
import { User as AuthenticatedUser } from "../../common/decorators/User.decorator.js";
import { OrderResponseDto } from "./Order.dto.js";

@Controller()
export class OrderController {
  public constructor(
    @Inject(OrderUseCase)
    private readonly orderUseCase: OrderUseCase,
  ) { }

  /** Turns the current user's cart into an order. 201 Created on success. */
  @Post("/checkout")
  public async checkout(@AuthenticatedUser() user: DomainUser): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.checkout(user.id));
  }

  @Get("/orders")
  public async listOrders(@AuthenticatedUser() user: DomainUser): Promise<OrderResponseDto[]> {
    const orders: Order[] = await this.orderUseCase.listOrders(user.id);
    return orders.map(OrderResponseDto.from);
  }

  @Get("/orders/:orderId")
  public async getOrder(@AuthenticatedUser() user: DomainUser, @Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.getOrder(user.id, orderId));
  }
}
