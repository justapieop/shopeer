import type { CartLine, CartView } from "@shopeer/case";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";

export class AddCartItemDto {
  @ApiProperty({ type: String, minLength: 1, example: "product-1" })
  @IsString()
  @IsNotEmpty()
  public readonly productId!: string;

  @ApiProperty({ type: "integer", minimum: 1, description: "Units to add to the existing quantity.", example: 2 })
  @IsInt()
  @Min(1)
  public readonly quantity!: number;
}

export class UpdateCartItemDto {
  @ApiProperty({ type: "integer", minimum: 1, description: "New total quantity for this cart line.", example: 3 })
  @IsInt()
  @Min(1)
  public readonly quantity!: number;
}

export class CartLineResponseDto {
  @ApiProperty({ type: String, example: "product-1" })
  public readonly productId!: string;
  @ApiProperty({ type: String, example: "Notebook" })
  public readonly name!: string;
  @ApiProperty({ type: String, example: "https://example.com/notebook.jpg" })
  public readonly imageUrl!: string;
  @ApiProperty({ type: "integer", format: "int64", description: "Current unit price in VND.", example: 25000 })
  public readonly unitPrice!: number;
  @ApiProperty({ type: "integer", minimum: 1, example: 2 })
  public readonly quantity!: number;
  @ApiProperty({ type: "integer", format: "int64", description: "Unit price multiplied by quantity, in VND.", example: 50000 })
  public readonly subtotal!: number;
  /** Stock left right now; the client can warn when quantity > stock. */
  @ApiProperty({ type: "integer", minimum: 0, description: "Available stock; adding to a cart does not reserve it.", example: 10 })
  public readonly stock!: number;

  public static from(line: CartLine): CartLineResponseDto {
    return {
      productId: line.product.productId,
      name: line.product.name,
      imageUrl: line.product.imageUrl,
      unitPrice: line.product.price,
      quantity: line.item.quantity,
      subtotal: line.subtotal,
      stock: line.product.stock,
    };
  }
}

export class CartResponseDto {
  @ApiProperty({ type: String, example: "cart-1" })
  public readonly cartId!: string;
  @ApiProperty({ type: () => CartLineResponseDto, isArray: true })
  public readonly items!: CartLineResponseDto[];
  @ApiProperty({ type: "integer", minimum: 0, example: 2 })
  public readonly totalQuantity!: number;
  @ApiProperty({ type: "integer", format: "int64", minimum: 0, description: "Cart total in VND.", example: 50000 })
  public readonly totalAmount!: number;

  public static from(view: CartView): CartResponseDto {
    return {
      cartId: view.cart.cartId,
      items: view.lines.map(CartLineResponseDto.from),
      totalQuantity: view.totalQuantity,
      totalAmount: view.totalAmount,
    };
  }
}
