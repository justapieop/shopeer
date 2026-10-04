import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isBlankString } from "./utils.js";

export class Transaction extends Domain {
    public readonly transactionId!: string;
    public readonly amount!: number;
    public readonly status!: string;
    public readonly method!: string;
    public readonly orderId!: string;

    public constructor(protected readonly details: TransactionDetails) {
        super(details);
        this.transactionId = details.transactionId;
        this.amount = details.amount;
        this.status = details.status;
        this.method = details.method;
        this.orderId = details.orderId;
    }

    public validate(): InvalidParametersError | null {
        if (isBlankString(this.details.transactionId)) {
            return new InvalidParametersError(
                "transactionId must not be blank",
            );
        }

        if (this.details.amount <= 0) {
            return new InvalidParametersError("amount must be greater than 0");
        }

        if (isBlankString(this.details.status)) {
            return new InvalidParametersError("status must not be blank");
        }

        if (isBlankString(this.details.method)) {
            return new InvalidParametersError("method must not be blank");
        }

        if (isBlankString(this.details.orderId)) {
            return new InvalidParametersError("orderId must not be blank");
        }

        return null;
    }
}

export interface TransactionDetails extends DomainDetails {
    transactionId: string;
    amount: number;
    status: string;
    method: string;
    orderId: string;
}
