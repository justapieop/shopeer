import { Body, Controller, Inject, Param, Put } from "@nestjs/common";
import { ProductOwnershipUseCase } from "@shopeer/case";
import { Permission } from "@shopeer/domain";
import { ApiBody, ApiCookieAuth, ApiOkResponse, ApiOperation, ApiParam, ApiProperty, ApiTags } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";

export class AssignSellerDto {
  @ApiProperty({ type: String })
  @IsString() @IsNotEmpty() @MaxLength(256)
  public readonly sellerId!: string;
}
export class ProductSellerResponseDto {
  @ApiProperty({ type: String })
  public readonly productId!: string;
  @ApiProperty({ type: String })
  public readonly sellerId!: string;
}

@Controller("/admin/products")
@RequirePermissions(Permission.Super)
@ApiTags("Product ownership")
@ApiCookieAuth("cookie")
@ApiErrors({ status: 401, description: "Authentication required." }, { status: 403, description: "Super permission required." }, { status: 500, description: "Unexpected server error." })
export class ProductOwnershipController {
  constructor(@Inject(ProductOwnershipUseCase) private readonly ownership: ProductOwnershipUseCase) {}

  @Put("/:productId/seller")
  @ApiOperation({ summary: "Assign a product seller", description: "Super only. Target must be an active user with Sell permission. Only future checkout lines use the new assignment; historical order ownership never changes." })
  @ApiParam({ name: "productId", type: String })
  @ApiBody({ type: AssignSellerDto })
  @ApiOkResponse({ type: ProductSellerResponseDto })
  @ApiErrors({ status: 400, description: "Invalid input or target is not an active seller." }, { status: 404, description: "Product or seller not found." })
  async assign(@Param("productId") productId: string, @Body() data: AssignSellerDto): Promise<ProductSellerResponseDto> {
    await this.ownership.assignSeller(productId, data.sellerId);
    return { productId, sellerId: data.sellerId };
  }
}
