import { Module } from "@nestjs/common";
import { UserController } from "./User.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmUserRepository, UserEntity } from "./User.repository.js";
import { UserUseCase } from "@shopeer/case";
import type { UserRepository } from "@shopeer/case";

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
    TypeOrmUserRepository,
  ],
})
export class UserModule { }
