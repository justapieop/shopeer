import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class Order extends Domain {
    public readonly orderId!: string;
    public readonly cartId!: string;
    public readonly totalAmount!: number;
    public readonly status!: string;
    public readonly createdAt!: Date;

    public constructor(protected readonly details: OrderDetails) {
        super(details);
        this.orderId = details.orderId;
        this.cartId = details.cartId;
        this.totalAmount = details.totalAmount;
        this.status = details.status;
        this.createdAt = details.createdAt;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.orderId)) {
            return new InvalidParametersError("orderId must not be blank");
        }

        if (isBlankString(this.details.cartId)) {
            return new InvalidParametersError("cartId must not be blank");
        }

        if (this.details.totalAmount <= 0) {
            return new InvalidParametersError(
                "totalAmount must be greater than 0",
            );
        }

        if (isBlankString(this.details.status)) {
            return new InvalidParametersError("status must not be blank");
        }

        if (
            !this.details.createdAt ||
            !(this.details.createdAt instanceof Date)
        ) {
            return new InvalidParametersError("createdAt must be a valid Date");
        }

        return null;
    }
}

export interface OrderDetails extends DomainDetails {
    orderId: string;
    cartId: string;
    totalAmount: number;
    status: string;
    createdAt: Date;
}

export interface OrderRepository {
    save(order: Order): Order | Promise<Order>;
    fetchOrderById(orderId: string): Order | null | Promise<Order | null>;
}
