import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Cart, type CartRepository } from "@shopeer/domain";
import { Column, Entity, PrimaryColumn, Repository } from "typeorm";

@Entity({
  name: "carts",
})
export class CartEntity {
  @PrimaryColumn({ type: "text", })
  public readonly id!: string;

  @Column({ type: "text", name: "user_id", unique: true, })
  public readonly userId!: string;

  @Column({ type: "timestamptz", name: "created_at", })
  public readonly createdAt!: Date;

  @Column({ type: "timestamptz", name: "updated_at", })
  public readonly updatedAt!: Date;
}

@Injectable()
export class TypeOrmCartRepository implements CartRepository {
  public constructor(
    @InjectRepository(CartEntity)
    private readonly cartRepository: Repository<CartEntity>,
  ) { }

  public async save(cart: Cart): Promise<Cart> {
    return toDomain(await this.cartRepository.save(toEntity(cart)));
  }

  public async fetchCartById(cartId: string): Promise<Cart | null> {
    const entity: CartEntity | null = await this.cartRepository.findOneBy({ id: cartId, });
    return entity ? toDomain(entity) : null;
  }

  public async fetchCartByUserId(userId: string): Promise<Cart | null> {
    const entity: CartEntity | null = await this.cartRepository.findOneBy({ userId, });
    return entity ? toDomain(entity) : null;
  }

  /**
   * INSERT … ON CONFLICT DO NOTHING: if another request created the user's
   * cart first, the UNIQUE(user_id) constraint makes this insert a no-op
   * instead of an error, and we read back the cart that won.
   */
  public async insertIfAbsent(cart: Cart): Promise<Cart> {
    await this.cartRepository
      .createQueryBuilder()
      .insert()
      .values(toEntity(cart))
      .orIgnore()
      .execute();

    return toDomain(await this.cartRepository.findOneByOrFail({ userId: cart.userId, }));
  }
}

function toDomain(entity: CartEntity): Cart {
  return new Cart({
    cartId: entity.id,
    userId: entity.userId,
    createdAt: entity.createdAt,
    updatedAt: entity.updatedAt,
  });
}

function toEntity(cart: Cart): CartEntity {
  return Object.assign(new CartEntity(), {
    id: cart.cartId,
    userId: cart.userId,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
  });
}
