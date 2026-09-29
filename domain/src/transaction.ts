import {
    Domain,
    InvalidParametersError,
    type DomainDetails,
} from "./shared.js";
import { isAlphaNumericString, isBlankString } from "./utils.js";

export class Transaction extends Domain {
    public readonly transactionId!: string;
    public readonly amount!: number;
    public readonly sum!: number;
    public readonly status!: string;
    public readonly method!: string;
    public readonly userId!: string;

    public constructor(protected readonly details: TransactionDetails) {
        super(details);
        this.transactionId = details.transactionId;
        this.amount = details.amount;
        this.sum = details.sum;
        this.status = details.status;
        this.method = details.method;
        this.userId = details.userId;
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

        if (this.details.sum <= 0) {
            return new InvalidParametersError("sum must be greater than 0");
        }

        if (isBlankString(this.details.status)) {
            return new InvalidParametersError("status must not be blank");
        }

        if (isBlankString(this.details.method)) {
            return new InvalidParametersError("method must not be blank");
        }

        if (isBlankString(this.details.userId)) {
            return new InvalidParametersError("userId must not be blank");
        }

        return null;
    }
}

export interface TransactionDetails extends DomainDetails {
    transactionId: string;
    amount: number;
    sum: number;
    status: string;
    method: string;
    userId: string;
}

export interface TransactionRepository {
    save(transaction: Transaction): Transaction | Promise<Transaction>;
    fetchTransactionsByUserId(
        userId: string,
    ): Transaction[] | Promise<Transaction[]>;
    fetchTransactionById(
        transactionId: string,
    ): Transaction | null | Promise<Transaction | null>;
}
