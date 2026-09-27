import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString, isPositiveInteger } from "./utils.js";

export class CartItem extends Domain {
    public readonly itemId!: string;
    public readonly cartId!: string;
    public readonly productId!: string;
    public readonly quantity!: number;

    public constructor(protected readonly details: CartItemDetails) {
        super(details);
        this.itemId = details.itemId;
        this.cartId = details.cartId;
        this.productId = details.productId;
        this.quantity = details.quantity;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.itemId)) {
            return new InvalidParametersError("itemId must not be blank");
        }

        if (isBlankString(this.details.cartId)) {
            return new InvalidParametersError("cartId must not be blank");
        }
        if (isBlankString(this.details.productId)) {
            return new InvalidParametersError("productId must not be blank");
        }

        if (!isPositiveInteger(this.details.quantity)) {
            return new InvalidParametersError(
                "quantity must be a positive integer",
            );
        }

        return null;
    }

    /** Returns a copy of this item with another quantity (domain objects are immutable). */
    public withQuantity(quantity: number): CartItem {
        return new CartItem({ ...this.details, quantity, });
    }
}

export interface CartItemDetails extends DomainDetails {
    itemId: string;
    cartId: string;
    productId: string;
    quantity: number;
}

export interface CartItemRepository {
    save(cartItem: CartItem): CartItem | Promise<CartItem>;
    fetchCartItemByItemId(
        itemId: string,
    ): CartItem | null | Promise<CartItem | null>;
    fetchCartItem(
        cartId: string,
        productId: string,
    ): CartItem | null | Promise<CartItem | null>;
    fetchCartItemsByCartId(cartId: string): CartItem[] | Promise<CartItem[]>;
    fetchCartItemsByProductId(
        productId: string,
    ): CartItem[] | Promise<CartItem[]>;
    /**
     * Adds `cartItem` to its cart. If the cart already has a line for the same
     * product, increases that line's quantity by `cartItem.quantity` instead.
     * Must be atomic so that two quick "add to cart" clicks never create two
     * lines for one product. Returns the resulting line.
     */
    addOrIncreaseQuantity(cartItem: CartItem): CartItem | Promise<CartItem>;
    /** Returns false when the cart has no line for this product. */
    deleteCartItem(cartId: string, productId: string): boolean | Promise<boolean>;
    deleteCartItemsByCartId(cartId: string): void | Promise<void>;
}
