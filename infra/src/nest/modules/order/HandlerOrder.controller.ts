import { Controller, Get, Header, HttpCode, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { OrderUseCase } from "@shopeer/case";
import { Permission } from "@shopeer/domain";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { OrderResponseDto } from "./Order.dto.js";
import { HandlerOrderQueryDto } from "./HandlerOrder.dto.js";

@Controller("/handler/orders")
@RequirePermissions(Permission.EditAnyOrder)
@ApiTags("Handler orders")
@ApiCookieAuth("cookie")
@ApiErrors({ status: 500, description: "Unexpected server error." })
export class HandlerOrderController {
  constructor(@Inject(OrderUseCase) private readonly orders: OrderUseCase) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "List orders for delivery handling", description: "Requires EditAnyOrder. Returns full orders across buyers, newest first. Optional status filter; defaults to page 1 and 20 results, maximum 100." })
  @ApiOkResponse({ type: [OrderResponseDto] })
  @ApiErrors({ status: 400, description: "Invalid pagination or status." }, { status: 401, description: "Authentication required." }, { status: 403, description: "EditAnyOrder required; suspended users are denied." })
  async list(@Query() query: HandlerOrderQueryDto): Promise<OrderResponseDto[]> {
    return (await this.orders.listHandlerOrders(query, query.status)).map(OrderResponseDto.from);
  }

  @Get("/:orderId")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Get a full order for delivery handling", description: "Requires EditAnyOrder." })
  @ApiParam({ name: "orderId", type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrors({ status: 401, description: "Authentication required." }, { status: 403, description: "EditAnyOrder required; suspended users are denied." }, { status: 404, description: "Order does not exist." })
  async get(@Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orders.getHandlerOrder(orderId));
  }

  @Post("/:orderId/confirm-delivery")
  @HttpCode(200)
  @ApiOperation({ summary: "Confirm an order was delivered", description: "Requires EditAnyOrder (order_handler, admin or owner). Moves pending to delivered; only the buyer can then complete it by confirming receipt. Repeated confirmation is safe." })
  @ApiParam({ name: "orderId", type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrors(
    { status: 401, description: "Authentication required." },
    { status: 403, description: "EditAnyOrder permission required; suspended users are denied." },
    { status: 404, description: "Order does not exist." },
    { status: 409, description: "Order was cancelled or changed during confirmation." },
    { status: 500, description: "Unexpected server error." },
  )
  async confirmDelivery(@Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orders.confirmDelivery(orderId));
  }
}
