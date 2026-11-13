import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsIn, IsOptional } from "class-validator";
import type { OrderStatus } from "@shopeer/domain";
import { PaginationQueryDto } from "../../common/Pagination.dto.js";

export class HandlerOrderQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ["pending", "delivered", "completed", "cancelled"] })
  @IsOptional()
  @IsIn(["pending", "delivered", "completed", "cancelled"])
  public status?: OrderStatus;
}
