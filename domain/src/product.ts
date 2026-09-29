import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString, isNonNegativeInteger, isPositiveInteger } from "./utils.js";

export class Product extends Domain {
    public readonly productId!: string;
    public readonly name!: string;
    public readonly description!: string;
    /** Price in VND (whole number, no decimals). */
    public readonly price!: number;
    public readonly categoryId!: string;
    public readonly stock!: number;
    public readonly imageUrl!: string;

    public constructor(protected readonly details: ProductDetails) {
        super(details);
        this.productId = details.productId;
        this.name = details.name;
        this.description = details.description;
        this.price = details.price;
        this.categoryId = details.categoryId;
        this.stock = details.stock;
        this.imageUrl = details.imageUrl;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.productId)) {
            return new InvalidParametersError("productId must not be blank");
        }

        if (isBlankString(this.details.name)) {
            return new InvalidParametersError("name must not be blank");
        }

        if (isBlankString(this.details.description)) {
            return new InvalidParametersError("description must not be blank");
        }

        if (!isPositiveInteger(this.details.price)) {
            return new InvalidParametersError("price must be a positive integer");
        }

        if (isBlankString(this.details.categoryId)) {
            return new InvalidParametersError("categoryId must not be blank");
        }

        if (!isNonNegativeInteger(this.details.stock)) {
            return new InvalidParametersError("stock must be a non-negative integer");
        }

        if (isBlankString(this.details.imageUrl)) {
            return new InvalidParametersError("imageUrl must not be blank");
        }

        return null;
    }

    /**
     * Whether the stock currently loaded covers `quantity`.
     * Only a hint for the user: the stock may change right after it was read,
     * so checkout must still reserve stock atomically in the database.
     */
    public hasEnoughStock(quantity: number): boolean {
        return this.stock >= quantity;
    }
}

export interface ProductDetails extends DomainDetails {
    productId: string;
    name: string;
    description: string;
    price: number;
    categoryId: string;
    stock: number;
    imageUrl: string;
}
