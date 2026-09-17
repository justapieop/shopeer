import "reflect-metadata";
import { StandardSchemaValidationPipe, type INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./nest/modules/app/App.module.js";
import { ConfigService } from "@nestjs/config";
import { NativeLogger } from "nestjs-pino";
import cookieParser from "cookie-parser";

export async function initInfra(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule, { bufferLogs: true, });
  app.useLogger(app.get(NativeLogger));
  app.useGlobalPipes(new StandardSchemaValidationPipe());
  app.use(cookieParser());

  const config: ConfigService = app.get(ConfigService);

  app.listen(config.getOrThrow("PORT"));
}