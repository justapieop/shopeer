import { Body, Controller, Get, Header, Inject, Param, Post, Query } from "@nestjs/common";
import { SalesUseCase, type SalesPeriod, type SellerProduct } from "@shopeer/case";
import { Permission, type User as DomainUser } from "@shopeer/domain";
import { ApiBody, ApiCookieAuth, ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsDateString, IsInt, IsNotEmpty, IsString, IsUrl, Max, MaxLength, Min } from "class-validator";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";
import { User } from "../../common/decorators/User.decorator.js";
import { PaginationQueryDto } from "../../common/Pagination.dto.js";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";

export class PublishPeriodDto {
  @ApiProperty({ type: Number, minimum: 0, maximum: 2147483647, description: "Additional units, added to the previous period's leftover stock." })
  @IsInt() @Min(0) @Max(2147483647) additionalStock!: number;
  @ApiProperty({ type: String, format: "date-time" })
  @IsDateString({ strict: true }) endsAt!: string;
}
export class PostProductDto {
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(200) name!: string;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(4000) description!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 }) @IsInt() @Min(1) @Max(2147483647) price!: number;
  @ApiProperty() @IsString() @IsNotEmpty() @MaxLength(256) categoryId!: string;
  @ApiProperty({ type: Number, minimum: 1, maximum: 2147483647 }) @IsInt() @Min(1) @Max(2147483647) stock!: number;
  @ApiProperty() @IsUrl({ protocols: ["https", "http"], require_protocol: true }) @MaxLength(2000) imageUrl!: string;
  @ApiProperty({ type: String, format: "date-time" }) @IsDateString({ strict: true }) endsAt!: string;
}
export class SalesPeriodResponseDto implements SalesPeriod {
  @ApiProperty() id!: string;
  @ApiProperty() productId!: string;
  @ApiProperty({ type: Number }) quantity!: number;
  @ApiProperty({ type: Number }) remaining!: number;
  @ApiProperty({ type: Number }) additionalStock!: number;
  @ApiProperty({ type: String, format: "date-time" }) startsAt!: Date;
  @ApiProperty({ type: String, format: "date-time" }) endsAt!: Date;
}
export class SellerProductResponseDto implements SellerProduct {
  @ApiProperty() productId!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ type: Number }) price!: number;
  @ApiProperty({ type: Number, description: "Remaining stock, including units awaiting a new period." }) stock!: number;
  @ApiProperty({ type: [SalesPeriodResponseDto], description: "The latest 20 periods, newest first." }) periods!: SalesPeriodResponseDto[];
}

@Controller("/seller/products")
@RequirePermissions(Permission.Sell)
@ApiCookieAuth("cookie")
@ApiTags("Seller products")
@ApiErrors({ status: 401, description: "Authentication required." }, { status: 403, description: "Active account with Sell permission required." }, { status: 400, description: "Invalid input." }, { status: 500, description: "Unexpected server error." })
export class SellerProductController {
  constructor(@Inject(SalesUseCase) private readonly sales: SalesUseCase) {}

  @Get()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "List your products and recent sales periods" })
  @ApiOkResponse({ type: [SellerProductResponseDto] })
  list(@User() user: DomainUser, @Query() pagination: PaginationQueryDto): Promise<SellerProduct[]> {
    return this.sales.list(user.id, pagination);
  }

  @Post()
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Post a new product and publish its first sales period", description: "Starts immediately. Product ownership comes from the authenticated seller. Published stock and terms cannot be edited." })
  @ApiBody({ type: PostProductDto })
  @ApiCreatedResponse({ type: SalesPeriodResponseDto })
  @ApiErrors({ status: 404, description: "Category not found." })
  create(@User() user: DomainUser, @Body() input: PostProductDto): Promise<SalesPeriod> {
    // Explicitly select writable fields; body-supplied ownership and sale identifiers are ignored.
    return this.sales.create(user.id, { name: input.name, description: input.description, price: input.price, categoryId: input.categoryId, stock: input.stock, imageUrl: input.imageUrl }, new Date(input.endsAt));
  }

  @Post("/:productId/periods")
  @Header("Cache-Control", "no-store")
  @ApiOperation({ summary: "Publish another sales period", description: "Starts immediately once the previous period has ended or sold out. Quantity is remaining stock plus additionalStock. Concurrent publications are serialized; published quantities cannot be edited." })
  @ApiParam({ name: "productId", type: String })
  @ApiBody({ type: PublishPeriodDto })
  @ApiCreatedResponse({ type: SalesPeriodResponseDto })
  @ApiErrors({ status: 404, description: "Product not found or belongs to another seller." }, { status: 409, description: "The current period has not ended." })
  publish(@User() user: DomainUser, @Param("productId") productId: string, @Body() input: PublishPeriodDto): Promise<SalesPeriod> {
    return this.sales.publish(user.id, productId, input.additionalStock, new Date(input.endsAt));
  }
}
