import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Inject, Param, Patch, Post } from "@nestjs/common";
import { CartUseCase } from "@shopeer/case";
import { CurrentUserId } from "../../common/decorators/CurrentUserId.decorator.js";
import { AddCartItemDto, CartResponseDto, UpdateCartItemDto } from "./Cart.dto.js";

/** Every route works on the cart of the current user. */
@Controller("/cart")
export class CartController {
  public constructor(
    @Inject(CartUseCase)
    private readonly cartUseCase: CartUseCase,
  ) { }

  @Get()
  public async getCart(@CurrentUserId() userId: string): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.getCart(userId));
  }

  @Post("/items")
  @HttpCode(HttpStatus.OK)
  public async addItem(@CurrentUserId() userId: string, @Body() data: AddCartItemDto): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.addItem(userId, data.productId, data.quantity));
  }

  @Patch("/items/:productId")
  public async updateItem(
    @CurrentUserId() userId: string,
    @Param("productId") productId: string,
    @Body() data: UpdateCartItemDto,
  ): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.updateItemQuantity(userId, productId, data.quantity));
  }

  @Delete("/items/:productId")
  public async removeItem(@CurrentUserId() userId: string, @Param("productId") productId: string): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.removeItem(userId, productId));
  }

  @Delete()
  public async clearCart(@CurrentUserId() userId: string): Promise<CartResponseDto> {
    return CartResponseDto.from(await this.cartUseCase.clearCart(userId));
  }
}
