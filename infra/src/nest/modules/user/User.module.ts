import { Module } from "@nestjs/common";
import { UserController } from "./User.controller.js";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TypeOrmUserRepository, UserEntity } from "./User.repository.js";
import { UserUseCase } from "@shopeer/case";
import type { UnitOfWork, UserRepository } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { UnitOfWorkModule } from "../unitOfWork/UnitOfWork.module.js";
import { UserPipe } from "../../common/decorators/User.decorator.js";

@Module({
  imports: [
    UnitOfWorkModule,
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
      useFactory: (unitOfWork: UnitOfWork, userRepository: UserRepository) =>
        new UserUseCase(unitOfWork, userRepository),
      inject: [
        TypeOrmUnitOfWork,
        TypeOrmUserRepository,
      ],
    },
  ],
  exports: [
    UserPipe,
    UserUseCase,
  ],
})
export class UserModule { }
