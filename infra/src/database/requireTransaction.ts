import type { EntityManager } from "typeorm";

export class TransactionRequiredError extends Error {
  public constructor() {
    super("A repository write requires an active Unit of Work transaction");
    this.name = new.target.name;
  }
}

/** Prevent writes through the normal repository providers or an expired scope. */
export function requireTransaction(manager: EntityManager): void {
  if (!manager.queryRunner?.isTransactionActive || manager.queryRunner.isReleased) {
    throw new TransactionRequiredError();
  }
}
