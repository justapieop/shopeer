import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { validate } from "./AppConfig.model.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggerModule, nativeLoggerOptions } from "nestjs-pino";
import { UserModule } from "../user/User.module.js";
import { AuthModule } from "../auth/Auth.module.js";
import { CacheModule } from "@nestjs/cache-manager";
import { ProductModule } from "../product/Product.module.js";
import { CartModule } from "../cart/Cart.module.js";
import { OrderModule } from "../order/Order.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      expandVariables: true,
      isGlobal: true,
      validate,
    }),
    CacheModule.register({
      isGlobal: true,
    }),
    LoggerModule.forRootAsync({
      imports: [
        ConfigModule,
      ],
      inject: [
        ConfigService,
      ],
      useFactory: (config: ConfigService) => {
        const devMode: boolean = config.get<string>("NODE_ENV", "productions") .trim().toLowerCase() === "development";
        return {
          pinoHttp: {
            ...nativeLoggerOptions,
            level: devMode ? "debug" : "info",
            autoLogging: devMode,
            quietReqLogger: !devMode,
            quietResLogger: !devMode,
          },
        }
      }
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
          synchronize: false,
          logging: devMode ? "all" : [],
          ssl: sslEnabled,
          migrations: [
            import.meta.dirname + "/migrations/**/*{.js,.ts}"
          ],
          migrationsRun: true,
        };
      },
    }),
    UserModule,
    AuthModule,
    ProductModule,
    CartModule,
    OrderModule,
  ],
})
export class AppModule { }