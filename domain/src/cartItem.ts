import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString } from "./utils.js";

export class cartItem extends Domain {
    public readonly itemID!: string;
    public readonly cartID!: string;
    public readonly productID!: string;
    public readonly quantity!: number;

    public constructor(protected readonly details: CartItemDetails) {
        super(details);
        this.itemID = details.itemID;
        this.cartID = details.cartID;
        this.productID = details.productID;
        this.quantity = details.quantity;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.itemID)) {
            return new InvalidParametersError("itemID must not be blank");
        }

        if (isBlankString(this.details.cartID)) {
            return new InvalidParametersError("cartID must not be blank");
        }
        if (isBlankString(this.details.productID)) {
            return new InvalidParametersError("productID must not be blank");
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
    itemID: string;
    cartID: string;
    productID: string;
    quantity: number;
}

export interface CartItemRepository {
    save(cartItem: cartItem): cartItem | Promise<cartItem>;
    fetchcartItemByItemId(
        itemID: string,
    ): cartItem | null | Promise<cartItem | null>;
    fetchcartItemsByCartId(cartID: string): cartItem[] | Promise<cartItem[]>;
    fetchcartItemsByProductId(
        productID: string,
    ): cartItem[] | Promise<cartItem[]>;
}
