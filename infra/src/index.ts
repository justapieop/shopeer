import "reflect-metadata";
import { StandardSchemaValidationPipe, ValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./nest/modules/app/App.module.js";
import { ConfigService } from "@nestjs/config";
import { NativeLogger } from "nestjs-pino";
import cookieParser from "cookie-parser";
import { DomainErrorFilter } from "./nest/common/filters/DomainError.filter.js";

export async function initInfra(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule, { bufferLogs: true, });
  app.useLogger(app.get(NativeLogger));
  // StandardSchemaValidationPipe only runs when a Standard Schema (zod, valibot…) is attached.
  // ValidationPipe is the one that enforces class-validator decorators on DTO classes.
  app.useGlobalPipes(new StandardSchemaValidationPipe(), new ValidationPipe({ transform: true, }));
  app.useGlobalFilters(new DomainErrorFilter());
  app.use(cookieParser());

  const config: ConfigService = app.get(ConfigService);

  console.log(import.meta.dirname);

  app.listen(config.getOrThrow("PORT"));
}