import { ApiProperty } from "@nestjs/swagger";
import type { User } from "@shopeer/domain";

/** Explicit public projection; never serialize the user domain object. */
export class UserResponseDto {
  @ApiProperty({ type: String, example: "user-1" })
  public readonly id!: string;

  @ApiProperty({ type: String, example: "alice" })
  public readonly username!: string;

  @ApiProperty({ type: String, format: "date-time", example: "2026-10-20T08:00:00.000Z" })
  public readonly createdAt!: Date;

  @ApiProperty({ type: Boolean, example: false })
  public readonly suspended!: boolean;

  public static from(user: User): UserResponseDto {
    return { id: user.id, username: user.username, createdAt: user.createdAt, suspended: user.suspended };
  }
}
