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

export class InvalidParametersError extends Error { }