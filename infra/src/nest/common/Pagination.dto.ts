import { Transform } from "class-transformer";
import { IsInt, Max, Min } from "class-validator";
import { ApiPropertyOptional } from "@nestjs/swagger";

// Only decimal query strings are converted; empty, repeated and nested values fail validation.
const queryInteger = ({ value }: { value: unknown }): unknown =>
  typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;

export class PaginationQueryDto {
  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER, default: 1 })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  public page: number = 1;

  @ApiPropertyOptional({ type: "integer", minimum: 1, maximum: 100, default: 20 })
  @Transform(queryInteger)
  @IsInt()
  @Min(1)
  @Max(100)
  public limit: number = 20;
}
