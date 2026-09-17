import { plainToInstance } from "class-transformer";
import { IsEnum, IsNumber, Max, Min, validateSync, ValidationError } from "class-validator";

export enum AppEnvironment { 
  Development = "development",
  Production = "production",
  Test = "test",
}

export class AppConfig {
  @IsNumber()
  @Min(0)
  @Max(65535)
  public PORT!: number;

  @IsEnum(AppEnvironment)
  public NODE_ENV!: AppEnvironment;
}

export function validate(config: Record<string, unknown>): AppConfig {
  const validatedConfig: AppConfig = plainToInstance(
    AppConfig,
    config,
    { enableImplicitConversion: true },
  );
  const errors: ValidationError[] = validateSync(validatedConfig, { skipMissingProperties: false });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}