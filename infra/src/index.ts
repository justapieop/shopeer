import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./nest/modules/app/App.module.js";
import { ConfigService } from "@nestjs/config";
import { NativeLogger } from "nestjs-pino";

export async function initInfra(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule, { bufferLogs: true, });
  app.useLogger(app.get(NativeLogger));

  const config: ConfigService = app.get(ConfigService);

  app.listen(config.getOrThrow("PORT"));
}