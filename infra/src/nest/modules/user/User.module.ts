import { Module } from "@nestjs/common";
import { UserController } from "./User.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmUserRepository, UserEntity } from "./User.repository.js";
import { UserUseCase } from "@shopeer/case";
import type { UserRepository } from "@shopeer/case";
import { UserPipe } from "../../common/decorators/User.decorator.js";

@Module({
  imports: [
    TypeOrmModule.forFeature([UserEntity]),
  ],
  controllers: [
    UserController,
  ],
  providers: [
    TypeOrmUserRepository,
    UserPipe,
    {
      provide: UserUseCase,
      useFactory: (userRepository: UserRepository) => new UserUseCase(userRepository),
      inject: [
        TypeOrmUserRepository,
      ],
    },
  ],
  exports: [
    UserPipe,
    UserUseCase,
    TypeOrmUserRepository,
  ],
})
export class UserModule { }
