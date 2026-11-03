import { IsAlphanumeric, IsStrongPassword } from "class-validator";
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
  @ApiProperty({ type: String, example: "alice" })
  public readonly username!: string;
  @ApiProperty({ type: String, format: "password", writeOnly: true, example: "ExamplePass1!" })
  public readonly password!: string;
}
