import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { OrderUseCase, type IdGenerator, type OrderRepository, type UnitOfWork } from "@shopeer/case";
import { TypeOrmUnitOfWork } from "../../../database/TypeOrmUnitOfWork.js";
import { UnitOfWorkModule } from "../unitOfWork/UnitOfWork.module.js";
import { Cuid2IdGenerator } from "../../common/Cuid2IdGenerator.js";
import { UserModule } from "../user/User.module.js";
import { PermissionsModule } from "../permissions/Permissions.module.js";
import { OrderController } from "./Order.controller.js";
import { OrderEntity, OrderItemEntity, TypeOrmOrderRepository } from "./Order.repository.js";

@Module({
  imports: [
    UnitOfWorkModule,
    TypeOrmModule.forFeature([OrderEntity, OrderItemEntity]),
    UserModule,
    PermissionsModule,
  ],
  controllers: [
    OrderController,
  ],
  providers: [
    TypeOrmOrderRepository,
    Cuid2IdGenerator,
    {
      provide: OrderUseCase,
      useFactory: (
        unitOfWork: UnitOfWork,
        orderRepository: OrderRepository,
        idGenerator: IdGenerator,
      ) => new OrderUseCase(unitOfWork, orderRepository, idGenerator),
      inject: [
        TypeOrmUnitOfWork,
        TypeOrmOrderRepository,
        Cuid2IdGenerator,
      ],
    },
  ],
  exports: [OrderUseCase],
})
export class OrderModule { }
