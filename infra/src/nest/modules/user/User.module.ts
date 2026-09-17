import { Module } from "@nestjs/common";
import { UserController } from "./User.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmUserRepository, UserEntity } from "./User.repository.js";
import { UserUseCase } from "@shopeer/case";
import type { UserRepository } from "@shopeer/domain";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [
    UserController,
  ],
  providers: [
    TypeOrmUserRepository,
    {
      provide: UserUseCase,
      useFactory: (userRepository: UserRepository) => new UserUseCase(userRepository),
      inject: [
        TypeOrmUserRepository,
      ],
    },
  ],
  exports: [
    UserUseCase,
  ],
})
export class UserModule { }