/**
 * Creates unique ids for new domain objects.
 * Use cases depend on this port instead of a concrete library, so the
 * infrastructure layer decides how ids look and tests can use predictable ids.
 */
export interface IdGenerator {
  generate(): string;
}
