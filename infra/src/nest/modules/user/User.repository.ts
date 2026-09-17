import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import type { User, UserRepository } from "@shopeer/domain";
import { Check, Column, CreateDateColumn, Entity, Index, PrimaryColumn, Repository, Unique } from "typeorm";

@Entity({
  name: "users",
})
@Unique(["username"])
export class UserEntity {
  @PrimaryColumn()
  public readonly id!: string;

  @Column({ type: "text", nullable: false, })
  @Index()
  @Check(`'username' ~ '^[A-Za-z0-9]+$'`)
  public readonly username!: string;

  @Column({ type: "text", nullable: false, })
  public readonly password!: string;

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
    private readonly userRepository: Repository<User>,
  ) { }

  public async save(user: User): Promise<User> { 
    return await this.userRepository.save(user);
  }
}