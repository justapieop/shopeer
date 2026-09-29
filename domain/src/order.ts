import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class Order extends Domain {
    public readonly orderId!: string;
    public readonly userId!: string;

    public constructor(protected readonly details: OrderDetails) {
        super(details);
        this.orderId = details.orderId;
        this.userId = details.userId;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.orderId)) {
            return new InvalidParametersError("orderId must not be blank");
        }

        if (isBlankString(this.details.userId)) {
            return new InvalidParametersError("userId must not be blank");
        }

        return null;
    }
}

export interface OrderDetails extends DomainDetails {
    orderId: string;
    userId: string;
}

export interface OrderRepository {
    save(order: Order): Order | Promise<Order>;
    fetchOrderById(orderId: string): Order | null | Promise<Order | null>;
}
