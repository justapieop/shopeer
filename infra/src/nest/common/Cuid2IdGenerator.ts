import { Injectable } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import type { IdGenerator } from "@shopeer/case";

/** Adapter of the IdGenerator port, backed by cuid2 (same ids as users). */
@Injectable()
export class Cuid2IdGenerator implements IdGenerator {
  public generate(): string {
    return createId();
  }
}
