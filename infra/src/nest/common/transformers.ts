import type { ValueTransformer } from "typeorm";

/**
 * Reads Postgres `bigint` columns (money in VND) as JavaScript numbers.
 * Safe while amounts stay below Number.MAX_SAFE_INTEGER (~9 × 10^15 VND).
 */
export const bigintToNumber: ValueTransformer = {
  to: (value: number): number => value,
  from: (value: string | number): number => Number(value),
};

/**
 * Reads Postgres `bigint` columns (permission bits) as JavaScript bigints and
 * writes them back as decimal strings, which Postgres parses without loss.
 *
 * The connection uses `parseInt8`, so reads arrive as numbers: exact for every
 * bit up to 52, which leaves plenty of room for permissions.
 */
export const bigintToBigInt: ValueTransformer = {
  to: (value: bigint | undefined): string | undefined => value?.toString(),
  from: (value: string | number): bigint => BigInt(value),
};
