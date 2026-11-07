import { CartChangedError, CartItem } from "@shopeer/domain";
import type { CartItemRepository, RepositorySet, UnitOfWork } from "./ports.js";

export class CartItemUseCase {
    public constructor(
        private readonly unitOfWork: UnitOfWork<Pick<RepositorySet, "carts" | "cartItems">>,
        private readonly cartItemRepository: CartItemRepository,
    ) {}

    /** Edit an existing line; additions use CartUseCase.addItem. */
    public async save(cartItem: CartItem): Promise<CartItem> {
        return this.unitOfWork.execute(async ({ carts, cartItems }) => {
            await carts.lockCart(cartItem.cartId);
            if (!await cartItems.updateQuantity(cartItem)) throw new CartChangedError();
            return cartItem;
        });
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
