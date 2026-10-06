import { Transaction } from "@shopeer/domain";
import type { TransactionRepository } from "./ports.js";

export class TransactionUseCase {
    public constructor(
        private readonly transactionRepository: TransactionRepository,
    ) {}

    public async save(transaction: Transaction): Promise<Transaction> {
        return await this.transactionRepository.save(transaction);
    }

    public async fetchTransactionsByOrderId(
        orderId: string,
    ): Promise<Transaction[]> {
        return await this.transactionRepository.fetchTransactionsByOrderId(
            orderId,
        );
    }

    public async fetchTransactionById(
        transactionId: string,
    ): Promise<Transaction | null> {
        return await this.transactionRepository.fetchTransactionById(
            transactionId,
        );
    }
}
