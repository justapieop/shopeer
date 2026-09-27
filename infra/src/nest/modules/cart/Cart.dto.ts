import type { CartLine, CartView } from "@shopeer/case";
import { IsInt, IsNotEmpty, IsString, Min } from "class-validator";

export class AddCartItemDto {
  @IsString()
  @IsNotEmpty()
  public readonly productId!: string;

  @IsInt()
  @Min(1)
  public readonly quantity!: number;
}

export class UpdateCartItemDto {
  @IsInt()
  @Min(1)
  public readonly quantity!: number;
}

export class CartLineResponseDto {
  public readonly productId!: string;
  public readonly name!: string;
  public readonly imageUrl!: string;
  public readonly unitPrice!: number;
  public readonly quantity!: number;
  public readonly subtotal!: number;
  /** Stock left right now; the client can warn when quantity > stock. */
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
  public readonly cartId!: string;
  public readonly items!: CartLineResponseDto[];
  public readonly totalQuantity!: number;
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
