import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validate } from "./AppConfig.model.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggerModule, nativeLoggerOptions } from "nestjs-pino";
import { UserModule } from "../user/User.module.js";
import { AuthModule } from "../auth/Auth.module.js";

@Module({
  imports: [
    LoggerModule.forRoot({
      pinoHttp: nativeLoggerOptions,
    }),
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      validate,
    }),
    TypeOrmModule.forRootAsync({
      imports: [
        ConfigModule,
      ],
      inject: [
        ConfigService,
      ],
      useFactory: (config: ConfigService) => { 
        const devMode: boolean = config.get<string>("NODE_ENV", "productions") .trim().toLowerCase() === "development";
        const sslEnabled: boolean = config.get<string>("POSTGRES_SSL_ENABLE", "true").toLowerCase().trim() === "true";

        return {
          type: "postgres",
          host: config.getOrThrow("POSTGRES_HOST"),
          port: Number(config.getOrThrow("POSTGRES_PORT")),
          useUTC: true,
          username: config.getOrThrow("POSTGRES_USER"),
          password: config.getOrThrow("POSTGRES_PASSWORD"),
          parseInt8: true,
          cache: true,
          database: config.getOrThrow("POSTGRES_DB"),
          autoLoadEntities: true,
          synchronize: devMode,
          logging: devMode ? "all" : [],
          ssl: sslEnabled,
        };
      },
    }),
    UserModule,
    AuthModule,
  ],
})
export class AppModule { }