import type { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Roles and their permission bits (see Permission in domain/src/role.ts).
 * Each user belongs to exactly one role through users.role_id.
 *
 * The preset roles have fixed, readable ids so that code and seed data can
 * refer to them directly. `permission` is the sum of 2^bit of every granted
 * permission, e.g. member = Buy (2^1) + Sell (2^2) = 6.
 */
export class Roles1791786448696 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id"         text PRIMARY KEY,
        "name"       text NOT NULL UNIQUE,
        "permission" bigint NOT NULL DEFAULT 0 CHECK ("permission" >= 0),
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      INSERT INTO "roles" ("id", "name", "permission") VALUES
        ('member',        'Thành viên',   6),
        ('no_sell',       'Cấm bán',      2),
        ('no_buy',        'Cấm mua',      4),
        ('support',       'Hỗ trợ',       174),
        ('order_handler', 'Xử lý đơn',    238),
        ('admin',         'Quản trị',     510),
        ('owner',         'Chủ hệ thống', 1)
    `);

    // The DEFAULT fills every existing user with 'member' while adding the
    // column, and keeps registration working without knowing about roles.
    await queryRunner.query(`
      ALTER TABLE "users"
        ADD COLUMN "role_id" text NOT NULL DEFAULT 'member' REFERENCES "roles" ("id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role_id"`);
    await queryRunner.query(`DROP TABLE "roles"`);
  }
}
