import { Controller, Get, Inject, Param, Post } from "@nestjs/common";
import { OrderUseCase } from "@shopeer/case";
import type { Order } from "@shopeer/domain";
import type { User as DomainUser } from "@shopeer/domain";
import { User as AuthenticatedUser } from "../../common/decorators/User.decorator.js";
import { OrderResponseDto } from "./Order.dto.js";
import { ApiBearerAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";

@Controller()
@ApiTags("Orders")
@ApiBearerAuth("bearer")
@ApiErrors(
  { status: 401, description: "Missing, invalid, or expired JWT, or the token's user no longer exists." },
  { status: 403, description: "The authenticated user is suspended." },
  { status: 500, description: "An unexpected server error occurred." },
)
export class OrderController {
  public constructor(
    @Inject(OrderUseCase)
    private readonly orderUseCase: OrderUseCase,
  ) { }

  /** Turns the current user's cart into an order. 201 Created on success. */
  @Post("/checkout")
  @ApiOperation({ summary: "Check out the current user's cart", description: "Atomically reserves stock, creates the order with price snapshots, and removes purchased cart lines. No request body is needed." })
  @ApiCreatedResponse({ type: OrderResponseDto })
  @ApiErrors(
    { status: 404, description: "A cart product is no longer available." },
    { status: 409, description: "The cart is empty, changed during checkout, or has insufficient stock. Stock conflicts include productIds." },
  )
  public async checkout(@AuthenticatedUser() user: DomainUser): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.checkout(user.id));
  }

  @Get("/orders")
  @ApiOperation({ summary: "List the current user's orders", description: "Returns orders newest first." })
  @ApiOkResponse({ type: [OrderResponseDto] })
  public async listOrders(@AuthenticatedUser() user: DomainUser): Promise<OrderResponseDto[]> {
    const orders: Order[] = await this.orderUseCase.listOrders(user.id);
    return orders.map(OrderResponseDto.from);
  }

  @Get("/orders/:orderId")
  @ApiOperation({ summary: "Get one of the current user's orders" })
  @ApiParam({ name: "orderId", type: String, example: "order-1" })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrors({ status: 404, description: "The order does not exist or belongs to another user." })
  public async getOrder(@AuthenticatedUser() user: DomainUser, @Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orderUseCase.getOrder(user.id, orderId));
  }
}
