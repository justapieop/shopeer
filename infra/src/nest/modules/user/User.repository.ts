import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { User, UsernameAlreadyExistsError } from "@shopeer/domain";
import type { UserRepository } from "@shopeer/case";
import { Check, Column, CreateDateColumn, DefaultNamingStrategy, Entity, Index, PrimaryColumn, QueryFailedError, Repository, Unique } from "typeorm";
import { requireTransaction } from "../../../database/requireTransaction.js";

// The initial migration creates both a unique constraint and a unique index.
// Either can report the violation; preserve their existing generated names.
const naming = new DefaultNamingStrategy();
const usernameConstraints = new Set([
  naming.uniqueConstraintName("users", ["username"]),
  naming.indexName("users", ["username"]),
]);

@Entity({
  name: "users",
})
@Unique(["username"])
export class UserEntity {
  @PrimaryColumn()
  public readonly id!: string;

  @Column({ type: "text", nullable: false, })
  @Index()
  @Check(`username ~ '^[A-Za-z0-9]+$'`)
  public readonly username!: string;

  @Column({ type: "text", name: "hashed_password", nullable: false, })
  public readonly hashedPassword!: string;

  @CreateDateColumn({ name: "created_at", })
  public readonly createdAt!: Date;

  @Column({
    type: "boolean", nullable: false, default: false,
  })
  public readonly suspended!: boolean;
}

@Injectable()
export class TypeOrmUserRepository implements UserRepository { 
  public constructor(
    @InjectRepository(UserEntity)
    private readonly userRepository: Repository<UserEntity>,
  ) { }

  public async create(user: User): Promise<User> {
    requireTransaction(this.userRepository.manager);
    try {
      await this.userRepository.insert(toEntity(user));
    } catch (error) {
      if (error instanceof QueryFailedError) {
        const driverError = error.driverError as { code?: string; constraint?: string };
        if (driverError.code === "23505" && usernameConstraints.has(driverError.constraint ?? "")) {
          throw new UsernameAlreadyExistsError(user.username);
        }
      }
      throw error;
    }
    return user;
  }

  public async fetchUserById(id: string): Promise<User | null> {
    const entity: UserEntity | null = await this.userRepository.findOneBy({ id, });

    if (!entity) { 
      return null;
    }

    return toDomain(entity);
  }

  public async fetchUserByUsername(username: string): Promise<User | null> {
    const entity: UserEntity | null = await this.userRepository.findOneBy({ username, });

    if (!entity) { 
      return null;
    }

    return toDomain(entity);
  }

  public async save(user: User): Promise<User> { 
    requireTransaction(this.userRepository.manager);
    return toDomain(await this.userRepository.save(toEntity(user)));
  }
}

function toDomain(user: UserEntity): User { 
  return new User({
    id: user.id,
    username: user.username,
    hashedPassword: user.hashedPassword,
    createdAt: user.createdAt,
    suspended: user.suspended,
  });
}

function toEntity(user: User): UserEntity { 
  return Object.assign(new UserEntity(), {
    id: user.id,
    username: user.username,
    hashedPassword: user.hashedPassword,
    createdAt: user.createdAt,
    suspended: user.suspended,
  });
}
