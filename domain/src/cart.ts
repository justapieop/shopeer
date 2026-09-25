import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class Cart extends Domain {
    public readonly cartID!: string;
    public readonly createdAt!: Date;
    public readonly updatedAt!: Date;
    public readonly userID!: string;

    public constructor(protected readonly details: CartDetails) {
        super(details);

        this.cartID = details.cartID;
        this.createdAt = details.createdAt ?? new Date();
        this.updatedAt = details.updatedAt ?? new Date();
        this.userID = details.userID;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.cartID)) {
            return new InvalidParametersError("cartID must not be blank");
        }

        if (isBlankString(this.details.userID)) {
            return new InvalidParametersError("userID must not be blank");
        }

        return null;
    }
}

export interface CartDetails extends DomainDetails {
    cartID: string;
    createdAt?: Date;
    updatedAt?: Date;
    userID: string;
}

export interface CartRepository {
    save(cart: Cart): Cart | Promise<Cart>;
    fetchCartById(cartID: string): Cart | null | Promise<Cart | null>;
    fetchCartByUserId(userID: string): Cart | null | Promise<Cart | null>;
}
