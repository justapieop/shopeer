export abstract class Domain {
  protected constructor(
    protected readonly details: DomainDetails,
  ) {
    const err: InvalidParametersError | null = this.validate();

    if (err) {
      throw err;
    }
  }

  public abstract validate(): InvalidParametersError | null;
}

export interface DomainDetails { }

/**
 * Base class of every business-rule error. Outer layers (e.g. HTTP) can map
 * each subclass to a suitable response without knowing the business rules.
 */
export class DomainError extends Error {
  public constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/** Input breaks a rule of a domain object (blank id, negative quantity…). */
export class InvalidParametersError extends DomainError { }

/** A referenced object (product, cart item, order…) does not exist. */
export class NotFoundError extends DomainError { }

/** The request conflicts with the current state of the system. */
export class ConflictError extends DomainError { }

/** Not enough stock for one or more products. */
export class OutOfStockError extends ConflictError {
  public constructor(public readonly productIds: string[]) {
    super(`Not enough stock for product(s): ${productIds.join(", ")}`);
  }
}

/** Checkout was requested on a cart without items. */
export class EmptyCartError extends ConflictError {
  public constructor() {
    super("Cart is empty");
  }
}

/** The cart changed while an order was being placed; the client should retry. */
export class CartChangedError extends ConflictError {
  public constructor() {
    super("Cart changed during checkout, please review your cart and try again");
  }
}
