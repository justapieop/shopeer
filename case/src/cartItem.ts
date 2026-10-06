import { CartItem } from "@shopeer/domain";
import type { CartItemRepository } from "./ports.js";

export class CartItemUseCase {
    public constructor(
        private readonly cartItemRepository: CartItemRepository,
    ) {}

    public async save(cartItem: CartItem): Promise<CartItem> {
        return await this.cartItemRepository.save(cartItem);
    }

    public async fetchCartItemByItemId(
        itemId: string,
    ): Promise<CartItem | null> {
        return await this.cartItemRepository.fetchCartItemByItemId(itemId);
    }

    public async fetchCartItem(
        cartId: string,
        productId: string,
    ): Promise<CartItem | null> {
        return await this.cartItemRepository.fetchCartItem(cartId, productId);
    }

    public async fetchCartItemsByCartId(cartId: string): Promise<CartItem[]> {
        return await this.cartItemRepository.fetchCartItemsByCartId(cartId);
    }

    public async fetchCartItemsByProductId(
        productId: string,
    ): Promise<CartItem[]> {
        return await this.cartItemRepository.fetchCartItemsByProductId(
            productId,
        );
    }
}
