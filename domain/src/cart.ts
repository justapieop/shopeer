import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString } from "./utils.js";

export class Cart extends Domain {
    public readonly cartId!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
    public readonly userId!: string;

    public constructor(protected readonly details: CartDetails) {
        super(details);

        this.cartId = details.cartId;
        this.createdAt = details.createdAt ?? new Date();
        this.updatedAt = details.updatedAt ?? new Date();
        this.userId = details.userId;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.cartId)) {
            return new InvalidParametersError("cartId must not be blank");
        }

        if (isBlankString(this.details.userId)) {
            return new InvalidParametersError("userId must not be blank");
        }

        return null;
    }
}

export interface CartDetails extends DomainDetails {
    cartId: string;
    createdAt?: Date;
    updatedAt?: Date;
    userId: string;
}

export interface CartRepository {
    save(cart: Cart): Cart | Promise<Cart>;
    fetchCartById(cartId: string): Cart | null | Promise<Cart | null>;
    fetchCartByUserId(userId: string): Cart | null | Promise<Cart | null>;
    /**
     * Stores `cart` unless its user already owns a cart, and returns the user's
     * cart either way. Must be atomic: two concurrent calls for the same user
     * end up with a single cart (each user has at most one cart).
     */
    insertIfAbsent(cart: Cart): Cart | Promise<Cart>;
}
