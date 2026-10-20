import { applyDecorators } from "@nestjs/common";
import { ApiProperty, ApiPropertyOptional, ApiResponse } from "@nestjs/swagger";

export class ApiErrorResponseDto {
  @ApiProperty({ type: "integer", example: 400 })
  public readonly statusCode!: number;

  @ApiProperty({ type: String, example: "Bad Request" })
  public readonly error!: string;

  @ApiProperty({
    oneOf: [{ type: "string" }, { type: "array", items: { type: "string" } }],
    example: "quantity must not be less than 1",
  })
  public readonly message!: string | string[];

  @ApiPropertyOptional({ type: [String], description: "Product IDs with insufficient stock; present on stock conflicts.", example: ["product-1"] })
  public readonly productIds?: string[];
}

/** Shared shape for both Nest HTTP errors and errors translated by DomainErrorFilter. */
export function ApiErrors(...responses: Array<{ status: number; description: string }>): ClassDecorator & MethodDecorator {
  return applyDecorators(...responses.map((response) => ApiResponse({ ...response, type: ApiErrorResponseDto })));
}
