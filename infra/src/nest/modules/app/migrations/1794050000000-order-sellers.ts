import type { MigrationInterface, QueryRunner } from "typeorm";

export class OrderSellers1794050000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "products" ADD COLUMN "seller_id" text REFERENCES "users"("id") ON DELETE SET NULL`);
    // Historical orders have no known seller. Never infer one from a role.
    await runner.query(`ALTER TABLE "order_items" ADD COLUMN "seller_id" text REFERENCES "users"("id") ON DELETE RESTRICT, ADD COLUMN "product_name" text NOT NULL DEFAULT 'Product', ADD COLUMN "image_url" text NOT NULL DEFAULT ''`);
    await runner.query(`UPDATE "order_items" i SET "product_name" = p."name", "image_url" = p."image_url" FROM "products" p WHERE p."id" = i."product_id"`);
    await runner.query(`CREATE INDEX "IDX_order_items_seller_order" ON "order_items"("seller_id", "order_id")`);
    await runner.query(`CREATE INDEX "IDX_products_seller" ON "products"("seller_id")`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`DROP INDEX "IDX_products_seller"`);
    await runner.query(`DROP INDEX "IDX_order_items_seller_order"`);
    await runner.query(`ALTER TABLE "order_items" DROP COLUMN "image_url", DROP COLUMN "product_name", DROP COLUMN "seller_id"`);
    await runner.query(`ALTER TABLE "products" DROP COLUMN "seller_id"`);
  }
}
