import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString } from "./utils.js";

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

        if (this.details.quantity <= 0) {
            return new InvalidParametersError(
                "quantity must be greater than 0",
            );
        }

        return null;
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
    fetchCartItemsByCartId(cartId: string): CartItem[] | Promise<CartItem[]>;
    fetchCartItemsByProductId(
        productId: string,
    ): CartItem[] | Promise<CartItem[]>;
}
