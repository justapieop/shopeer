import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Role } from "@shopeer/domain";
import type { RoleRepository } from "@shopeer/case";
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";
import { requireTransaction } from "../../../database/requireTransaction.js";
import { bigintToBigInt } from "../../common/transformers.js";

@Entity({
  name: "roles",
})
export class RoleEntity {
  @PrimaryColumn({ type: "text", })
  public readonly id!: string;

  @Column({ type: "text", unique: true, })
  public readonly name!: string;

  @Column({ type: "bigint", transformer: bigintToBigInt, })
  public readonly permission!: bigint;

  @Column({ type: "timestamptz", name: "created_at", })
  public readonly createdAt!: Date;
}

@Injectable()
export class TypeOrmRoleRepository implements RoleRepository {
  public constructor(
    @InjectRepository(RoleEntity)
    private readonly roleRepository: Repository<RoleEntity>,
  ) { }

  public async save(role: Role): Promise<Role> {
    requireTransaction(this.roleRepository.manager);
    return toDomain(await this.roleRepository.save(toEntity(role)));
  }

  public async fetchRoleById(roleId: string): Promise<Role | null> {
    const entity: RoleEntity | null = await this.roleRepository.findOneBy({ id: roleId, });
    return entity ? toDomain(entity) : null;
  }

  /** users.role_id is not mapped on UserEntity, so the lookup is written in SQL here. */
  public async fetchRoleByUserId(userId: string): Promise<Role | null> {
    const entity: RoleEntity | null = await this.roleRepository
      .createQueryBuilder("role")
      .where(`"role"."id" = (SELECT "role_id" FROM "users" WHERE "id" = :userId)`, { userId, })
      .getOne();

    return entity ? toDomain(entity) : null;
  }
}

function toDomain(entity: RoleEntity): Role {
  return new Role({
    id: entity.id,
    name: entity.name,
    permission: entity.permission,
    createdAt: entity.createdAt,
  });
}

function toEntity(role: Role): RoleEntity {
  return Object.assign(new RoleEntity(), {
    id: role.id,
    name: role.name,
    permission: role.getPermissionBits(),
    createdAt: role.createdAt,
  });
}
