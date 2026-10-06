import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from "@nestjs/common";
import { CartUseCase } from "@shopeer/case";
import type { User as DomainUser } from "@shopeer/domain";
import { User as AuthenticatedUser } from "../../common/decorators/User.decorator.js";
import { AddCartItemDto, CartResponseDto, UpdateCartItemDto } from "./Cart.dto.js";

/** Every route works on the cart of the current user. */
@Controller("/cart")
export class CartController {
  public constructor(
    @Inject(CartUseCase)
    private readonly cartUseCase: CartUseCase,
  ) { }

  @Get()
  public async getCart(@AuthenticatedUser() user: DomainUser): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.getCart(user.id));
  }

  @Post("/items")
  @HttpCode(HttpStatus.OK)
  public async addItem(@AuthenticatedUser() user: DomainUser, @Body() data: AddCartItemDto): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.addItem(user.id, data.productId, data.quantity));
  }

  @Patch("/items/:productId")
  public async updateItem(
    @AuthenticatedUser() user: DomainUser,
    @Param("productId") productId: string,
    @Body() data: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.updateItemQuantity(user.id, productId, data.quantity));
  }

  @Delete("/items/:productId")
  public async removeItem(@AuthenticatedUser() user: DomainUser, @Param("productId") productId: string): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.removeItem(user.id, productId));
  }

  @Delete()
  public async clearCart(@AuthenticatedUser() user: DomainUser): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.clearCart(user.id));
  }
}
