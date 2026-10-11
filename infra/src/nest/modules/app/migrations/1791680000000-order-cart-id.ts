import type { MigrationInterface, QueryRunner } from "typeorm";

/** Align persisted orders with the domain's required cartId. */
export class OrderCartId1791680000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "cart_id" text`);
    // Historical orders are backfilled using the user's unique cart.
    // SET NOT NULL deliberately fails if historical data has no matching cart,
    // allowing the migration transaction to roll back without inventing ids.
    await queryRunner.query(`
      UPDATE "orders" o SET "cart_id" = c."id"
      FROM "carts" c WHERE c."user_id" = o."user_id"
    `);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "cart_id" SET NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "cart_id"`);
  }
}
