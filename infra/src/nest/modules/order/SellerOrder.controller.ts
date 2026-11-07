import { Controller, Get, Header, Inject, Param, Query } from "@nestjs/common";
import { OrderUseCase } from "@shopeer/case";
import { Permission, type User as DomainUser } from "@shopeer/domain";
import { ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import { PaginationQueryDto } from "../../common/Pagination.dto.js";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";
import { User } from "../../common/decorators/User.decorator.js";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { OrderResponseDto } from "./Order.dto.js";

@Controller("/seller/orders")
@RequirePermissions(Permission.Sell)
@ApiTags("Seller orders")
@ApiCookieAuth("cookie")
@ApiErrors({ status: 401, description: "Missing or invalid authentication." }, { status: 403, description: "Sell permission required; suspended users are denied." }, { status: 500, description: "Unexpected server error." })
export class SellerOrderController {
  constructor(@Inject(OrderUseCase) private readonly orders: OrderUseCase) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "List orders containing the seller's placed products", description: "Only this seller's checkout-time lines and subtotal are returned. Newest first, paginated." })
  @ApiOkResponse({ type: [OrderResponseDto] })
  @ApiErrors({ status: 400, description: "Invalid pagination." })
  async list(@User() user: DomainUser, @Query() pagination: PaginationQueryDto): Promise<OrderResponseDto[]> {
    return (await this.orders.listSellerOrders(user.id, pagination)).map(OrderResponseDto.from);
  }

  @Get("/:orderId")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "View the seller's portion of a placed order" })
  @ApiParam({ name: "orderId", type: String })
  @ApiOkResponse({ type: OrderResponseDto })
  @ApiErrors({ status: 404, description: "Order does not exist or contains no lines belonging to this seller." })
  async get(@User() user: DomainUser, @Param("orderId") orderId: string): Promise<OrderResponseDto> {
    return OrderResponseDto.from(await this.orders.getSellerOrder(user.id, orderId));
  }
}
