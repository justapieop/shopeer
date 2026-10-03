import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { CartItem } from "@shopeer/domain";
import type { CartItemRepository } from "@shopeer/case";
import { Column, Entity, PrimaryColumn, Repository, Unique, type DeleteResult } from "typeorm";

@Entity({
  name: "cart_items",
})
@Unique("UQ_cart_items_cart_product", ["cartId", "productId"])
export class CartItemEntity {
  @PrimaryColumn({ type: "text", })
  public readonly id!: string;

  @Column({ type: "text", name: "cart_id", })
  public readonly cartId!: string;

  @Column({ type: "text", name: "product_id", })
  public readonly productId!: string;

  @Column({ type: "integer", })
  public readonly quantity!: number;
}

/** Row shape returned by the raw upsert query. */
interface CartItemRow {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
}

@Injectable()
export class TypeOrmCartItemRepository implements CartItemRepository {
  public constructor(
    @InjectRepository(CartItemEntity)
    private readonly cartItemRepository: Repository<CartItemEntity>,
  ) { }

  public async save(cartItem: CartItem): Promise<CartItem> {
    return toDomain(await this.cartItemRepository.save(toEntity(cartItem)));
  }

  public async fetchCartItemByItemId(itemId: string): Promise<CartItem | null> {
    const entity: CartItemEntity | null = await this.cartItemRepository.findOneBy({ id: itemId, });
    return entity ? toDomain(entity) : null;
  }

  public async fetchCartItem(cartId: string, productId: string): Promise<CartItem | null> {
    const entity: CartItemEntity | null = await this.cartItemRepository.findOneBy({ cartId, productId, });
    return entity ? toDomain(entity) : null;
  }

  public async fetchCartItemsByCartId(cartId: string): Promise<CartItem[]> {
    const entities: CartItemEntity[] = await this.cartItemRepository.find({
      where: { cartId, },
      order: { id: "ASC", },
    });
    return entities.map(toDomain);
  }

  public async fetchCartItemsByProductId(productId: string): Promise<CartItem[]> {
    const entities: CartItemEntity[] = await this.cartItemRepository.findBy({ productId, });
    return entities.map(toDomain);
  }

  /**
   * One atomic statement (an "upsert"). Two concurrent "add to cart" requests
   * for the same product cannot both insert a line: the UNIQUE(cart_id,
   * product_id) constraint turns the second insert into an update that adds
   * the quantities together.
   */
  public async addOrIncreaseQuantity(cartItem: CartItem): Promise<CartItem> {
    const rows: CartItemRow[] = await this.cartItemRepository.query(
      `INSERT INTO "cart_items" ("id", "cart_id", "product_id", "quantity")
       VALUES ($1, $2, $3, $4)
       ON CONFLICT ("cart_id", "product_id")
       DO UPDATE SET "quantity" = "cart_items"."quantity" + EXCLUDED."quantity"
       RETURNING "id", "cart_id", "product_id", "quantity"`,
      [cartItem.itemId, cartItem.cartId, cartItem.productId, cartItem.quantity],
    );
    const row: CartItemRow = rows[0]!;

    return new CartItem({
      itemId: row.id,
      cartId: row.cart_id,
      productId: row.product_id,
      quantity: row.quantity,
    });
  }

  public async deleteCartItem(cartId: string, productId: string): Promise<boolean> {
    const result: DeleteResult = await this.cartItemRepository.delete({ cartId, productId, });
    return (result.affected ?? 0) > 0;
  }

  public async deleteCartItemsByCartId(cartId: string): Promise<void> {
    await this.cartItemRepository.delete({ cartId, });
  }
}

function toDomain(entity: CartItemEntity): CartItem {
  return new CartItem({
    itemId: entity.id,
    cartId: entity.cartId,
    productId: entity.productId,
    quantity: entity.quantity,
  });
}

function toEntity(cartItem: CartItem): CartItemEntity {
  return Object.assign(new CartItemEntity(), {
    id: cartItem.itemId,
    cartId: cartItem.cartId,
    productId: cartItem.productId,
    quantity: cartItem.quantity,
  });
}
