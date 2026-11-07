import { Controller, HttpCode, Inject, Param, Post } from "@nestjs/common";
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { OrderUseCase } from "@shopeer/case";
import { Permission } from "@shopeer/domain";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { OrderResponseDto } from "./Order.dto.js";

@Controller("/handler/orders")
@RequirePermissions(Permission.EditAnyOrder)
@ApiTags("Handler orders")
@ApiCookieAuth("cookie")
export class HandlerOrderController {
  constructor(@Inject(OrderUseCase) private readonly orders: OrderUseCase) {}

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
