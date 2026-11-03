import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AuthorizationUseCase, type RoleRepository } from "@shopeer/case";
import { PermissionsGuard } from "../../common/guards/Permissions.guard.js";
import { RoleEntity, TypeOrmRoleRepository } from "../role/Role.repository.js";
import { UserModule } from "../user/User.module.js";

@Module({
  imports: [ConfigModule, UserModule, TypeOrmModule.forFeature([RoleEntity])],
  providers: [
    TypeOrmRoleRepository,
    {
      provide: AuthorizationUseCase,
      useFactory: (roles: RoleRepository) => new AuthorizationUseCase(roles),
      inject: [TypeOrmRoleRepository],
    },
    PermissionsGuard,
  ],
  exports: [PermissionsGuard, AuthorizationUseCase, UserModule],
})
export class PermissionsModule {}
