import type { ValueTransformer } from "typeorm";

/**
 * Reads Postgres `bigint` columns (money in VND) as JavaScript numbers.
 * Safe while amounts stay below Number.MAX_SAFE_INTEGER (~9 × 10^15 VND).
 */
export const bigintToNumber: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};
