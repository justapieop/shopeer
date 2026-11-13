import type { MigrationInterface, QueryRunner } from "typeorm";

/** Persist the lifecycle state instead of fabricating it when reading an order. */
export class OrderStatus1794000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Older orders were always reported as completed. Preserve that historical
    // behavior; new orders default to pending and checkout writes its own state.
    await queryRunner.query(`ALTER TABLE "orders" ADD COLUMN "status" text NOT NULL DEFAULT 'completed'`);
    await queryRunner.query(`ALTER TABLE "orders" ALTER COLUMN "status" SET DEFAULT 'pending'`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_status" CHECK ("status" IN ('pending', 'completed', 'cancelled'))`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status"`);
    await queryRunner.query(`ALTER TABLE "orders" DROP COLUMN "status"`);
  }
}
