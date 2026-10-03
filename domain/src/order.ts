import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString, isPositiveInteger } from "./utils.js";

/** One product line of an order. Keeps the price at the moment of purchase. */
export class OrderItem extends Domain {
    public readonly orderItemId!: string;
    public readonly orderId!: string;
    public readonly productId!: string;
    /** Price in VND of one unit when the order was placed. */
    public readonly unitPrice!: number;
    public readonly quantity!: number;

    public constructor(protected readonly details: OrderItemDetails) {
        super(details);
        this.orderItemId = details.orderItemId;
        this.orderId = details.orderId;
        this.productId = details.productId;
        this.unitPrice = details.unitPrice;
        this.quantity = details.quantity;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.orderItemId)) {
            return new InvalidParametersError("orderItemId must not be blank");
        }

        if (isBlankString(this.details.orderId)) {
            return new InvalidParametersError("orderId must not be blank");
        }

        if (isBlankString(this.details.productId)) {
            return new InvalidParametersError("productId must not be blank");
        }

        if (!isPositiveInteger(this.details.unitPrice)) {
            return new InvalidParametersError(
                "unitPrice must be a positive integer",
            );
        }

        if (!isPositiveInteger(this.details.quantity)) {
            return new InvalidParametersError(
                "quantity must be a positive integer",
            );
        }

        return null;
    }

    public get subtotal(): number {
        return this.unitPrice * this.quantity;
    }
}

export interface OrderItemDetails extends DomainDetails {
    orderItemId: string;
    orderId: string;
    productId: string;
    unitPrice: number;
    quantity: number;
}

export class Order extends Domain {
    public readonly orderId!: string;
    public readonly userId!: string;
    public readonly items!: readonly OrderItem[];
    public readonly status!: "pending" | "completed" | "cancelled";
    /** Sum of every item's subtotal, in VND. */
    public readonly totalAmount!: number;
    public readonly createdAt!: Date;

    public constructor(protected readonly details: OrderDetails) {
        super(details);
        this.orderId = details.orderId;
        this.userId = details.userId;
        this.status = details.status;
        this.items = [...details.items];
        this.totalAmount = details.items.reduce(
            (sum: number, item: OrderItem) => sum + item.subtotal,
            0,
        );
        this.createdAt = details.createdAt ?? new Date();
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.orderId)) {
            return new InvalidParametersError("orderId must not be blank");
        }

        if (isBlankString(this.details.userId)) {
            return new InvalidParametersError("userId must not be blank");
        }

        if (
            !this.details.status ||
            !["pending", "completed", "cancelled"].includes(this.details.status)
        ) {
            return new InvalidParametersError(
                "status must be one of: pending, completed, cancelled",
            );
        }

        if (this.details.items.length === 0) {
            return new InvalidParametersError(
                "an order must have at least one item",
            );
        }

        const productIds: Set<string> = new Set();

        for (const item of this.details.items) {
            if (item.orderId !== this.details.orderId) {
                return new InvalidParametersError(
                    "every item must belong to this order",
                );
            }

            if (productIds.has(item.productId)) {
                return new InvalidParametersError(
                    "a product must appear only once per order",
                );
            }

            productIds.add(item.productId);
        }

        return null;
    }
}

export interface OrderDetails extends DomainDetails {
    orderId: string;
    userId: string;
    items: OrderItem[];
    createdAt?: Date;
    status: "pending" | "completed" | "cancelled";
}
