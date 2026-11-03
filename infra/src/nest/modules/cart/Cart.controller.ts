import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { CartUseCase } from "@shopeer/case";
import { Permission, type User as DomainUser } from "@shopeer/domain";
import { User as AuthenticatedUser } from "../../common/decorators/User.decorator.js";
import {
  AddCartItemDto,
  CartResponseDto,
  UpdateCartItemDto,
} from "./Cart.dto.js";
import {
  ApiCookieAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from "@nestjs/swagger";
import { ApiErrors } from "../../common/openapi/ApiErrors.js";
import { RequirePermissions } from "../../common/decorators/RequirePermissions.decorator.js";

/** Every route works on the cart of the current user. */
@RequirePermissions(Permission.Buy)
@Controller("/cart")
@ApiTags("Cart")
@ApiCookieAuth("cookie")
@ApiErrors(
  {
    status: 401,
    description:
      "Missing, invalid, or expired JWT, or the token's user no longer exists.",
  },
  { status: 403, description: "The authenticated user is suspended." },
  { status: 500, description: "An unexpected server error occurred." },
)
export class CartController {
  public constructor(
    @Inject(CartUseCase)
    private readonly cartUseCase: CartUseCase,
  ) {}

  @Get()
  public async getCart(
    @AuthenticatedUser() user: DomainUser,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.getCart(user.id));
  }

  @Post("/items")
  @HttpCode(HttpStatus.OK)
  public async addItem(
    @AuthenticatedUser() user: DomainUser,
    @Body() data: AddCartItemDto,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(
      await this.cartUseCase.addItem(user.id, data.productId, data.quantity),
    );
  }

  @Patch("/items/:productId")
  @ApiOperation({ summary: "Set a cart line's quantity" })
  @ApiParam({ name: "productId", type: String, example: "product-1" })
  @ApiBody({ type: UpdateCartItemDto })
  @ApiOkResponse({ type: CartResponseDto })
  @ApiErrors(
    { status: 400, description: "Quantity must be a positive integer." },
    {
      status: 404,
      description: "The cart line, product, or user does not exist.",
    },
    {
      status: 409,
      description:
        "Insufficient stock for the requested quantity. Includes productIds.",
    },
  )
  public async updateItem(
    @AuthenticatedUser() user: DomainUser,
    @Param("productId") productId: string,
    @Body() data: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(
      await this.cartUseCase.updateItemQuantity(
        user.id,
        productId,
        data.quantity,
      ),
    );
  }

  @Delete("/items/:productId")
  public async removeItem(
    @AuthenticatedUser() user: DomainUser,
    @Param("productId") productId: string,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(
      await this.cartUseCase.removeItem(user.id, productId),
    );
  }

  @Delete()
  public async clearCart(
    @AuthenticatedUser() user: DomainUser,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.clearCart(user.id));
  }
}
