import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString } from "./utils.js";

export class Product extends Domain {
    public readonly productId!: string;
    public readonly name!: string;
    public readonly description!: string;
    public readonly price!: number;
    public readonly category!: string;
    public readonly stock!: number;
    public readonly imageURL!: string;

    public constructor(protected readonly details: ProductDetails) {
        super(details);
        this.productId = details.productId;
        this.name = details.name;
        this.description = details.description;
        this.price = details.price;
        this.category = details.category;
        this.stock = details.stock;
        this.imageURL = details.imageUrl;
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

        if (this.details.price <= 0) {
            return new InvalidParametersError("price must be greater than 0");
        }

        if (isBlankString(this.details.category)) {
            return new InvalidParametersError("category must not be blank");
        }

        if (this.details.stock < 0) {
            return new InvalidParametersError("stock must not be negative");
        }

        if (isBlankString(this.details.imageUrl)) {
            return new InvalidParametersError("imageUrl must not be blank");
        }

        return null;
    }
}

export interface ProductDetails extends DomainDetails {
    productId: string;
    name: string;
    description: string;
    price: number;
    category: string;
    stock: number;
    imageUrl: string;
}

export interface ProductRepository {
    save(product: Product): Product | Promise<Product>;
    fetchProductById(
        productId: string,
    ): Product | null | Promise<Product | null>;
    fetchProductsByCategory(category: string): Product[] | Promise<Product[]>;
}
