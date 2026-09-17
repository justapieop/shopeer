import { Expose } from "class-transformer";
import { IsAlphanumeric, IsStrongPassword } from "class-validator";

export class UserRegistrationDto {
  @IsAlphanumeric()
  public readonly username!: string;

  @IsStrongPassword({
    minLength: 10,
    minLowercase: 1,
    minNumbers: 1,
    minUppercase: 1,
    minSymbols: 1,
  })
  public readonly password!: string;
}

export class UserRegisterResponseDto {
  public readonly id!: string;
  public readonly username!: string;

  @Expose({ name: "created_at", })
  public readonly createdAt!: Date;
  public readonly suspended!: boolean;
}

export class UserLoginDto { 
  public readonly username!: string;
  public readonly password!: string;
}