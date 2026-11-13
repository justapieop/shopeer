import { InvalidParametersError } from "@shopeer/domain";

export interface Pagination {
  page: number;
  limit: number;
}

export function paginationOffset({ page, limit }: Pagination): number {
  const offset = (page - 1) * limit;
  if (!Number.isSafeInteger(page) || page < 1 ||
      !Number.isSafeInteger(limit) || limit < 1 || limit > 100 ||
      !Number.isSafeInteger(offset)) {
    throw new InvalidParametersError("page must be a positive safe integer and limit must be between 1 and 100");
  }
  return offset;
}
