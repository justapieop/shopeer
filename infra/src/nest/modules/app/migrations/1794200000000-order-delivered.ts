import type { MigrationInterface, QueryRunner } from "typeorm";

/** Preserve historical completed orders; new completions require both confirmations. */
export class OrderDelivered1794200000000 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_status" CHECK ("status" IN ('pending', 'delivered', 'completed', 'cancelled'))`);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    // Rollback must not turn an order awaiting buyer confirmation into a completed one.
    await queryRunner.query(`UPDATE "orders" SET "status" = 'pending' WHERE "status" = 'delivered'`);
    await queryRunner.query(`ALTER TABLE "orders" DROP CONSTRAINT "CHK_orders_status"`);
    await queryRunner.query(`ALTER TABLE "orders" ADD CONSTRAINT "CHK_orders_status" CHECK ("status" IN ('pending', 'completed', 'cancelled'))`);
  }
}
