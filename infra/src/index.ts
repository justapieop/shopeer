import type { INestApplication } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./nest/modules/app/App.module.js";
import { ConfigService } from "@nestjs/config";

export async function initInfra(): Promise<void> {
  const app: INestApplication = await NestFactory.create(AppModule);

  const config: ConfigService = app.get(ConfigService);

  app.listen(config.getOrThrow("PORT"));
}