import { Module } from "@nestjs/common";
import { UserModule } from "../user/User.module.js";
import { AuthService } from "./Auth.service.js";
import { AuthController } from "./Auth.controller.js";
import { ConfigModule } from "@nestjs/config";

@Module({
  imports: [
    UserModule,
    ConfigModule,
  ],
  providers: [
    AuthService,
  ],
  controllers: [
    AuthController,
  ],
})
export class AuthModule { }