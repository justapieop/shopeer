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
