import { IsAlphanumeric, IsStrongPassword, IsString, Matches, MaxLength } from "class-validator";
import { ApiProperty } from "@nestjs/swagger";
import { UserResponseDto } from "../user/User.dto.js";

export class UserRegistrationDto {
  @ApiProperty({ type: String, pattern: "^[A-Za-z0-9]+$", example: "alice", description: "Alphanumeric username." })
  @IsAlphanumeric()
  public readonly username!: string;

  @ApiProperty({ type: String, format: "password", minLength: 10, writeOnly: true, example: "ExamplePass1!", description: "At least 10 characters, including a lowercase letter, uppercase letter, number, and symbol." })
  @IsStrongPassword({
    minLength: 10,
    minLowercase: 1,
    minNumbers: 1,
    minUppercase: 1,
    minSymbols: 1,
  })
  public readonly password!: string;
}

export class UserRegisterResponseDto extends UserResponseDto { }

export class UserLoginDto { 
  @ApiProperty({ type: String, minLength: 1, maxLength: 256, pattern: "\\S", example: "alice" })
  @IsString()
  @Matches(/\S/, { message: "username must not be blank" })
  @MaxLength(256)
  public readonly username!: string;
  @ApiProperty({ type: String, format: "password", minLength: 1, maxLength: 1024, pattern: "\\S", writeOnly: true, example: "ExamplePass1!" })
  @IsString()
  @Matches(/\S/, { message: "password must not be blank" })
  @MaxLength(1024)
  public readonly password!: string;
}
