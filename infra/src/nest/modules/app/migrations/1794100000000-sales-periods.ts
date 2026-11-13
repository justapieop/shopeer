import type { MigrationInterface, QueryRunner } from "typeorm";

export class SalesPeriods1794100000000 implements MigrationInterface {
  async up(runner: QueryRunner): Promise<void> {
    await runner.query(`CREATE TABLE "sales_periods" (
      "id" text PRIMARY KEY, "product_id" text NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
      "quantity" integer NOT NULL CHECK (quantity > 0), "remaining" integer NOT NULL CHECK (remaining >= 0 AND remaining <= quantity),
      "additional_stock" integer NOT NULL CHECK (additional_stock >= 0),
      "starts_at" timestamptz NOT NULL, "ends_at" timestamptz NOT NULL CHECK (ends_at > starts_at))`);
    await runner.query(`CREATE INDEX "IDX_sales_periods_product" ON "sales_periods" ("product_id", "starts_at" DESC)`);
    await runner.query(`ALTER TABLE "products" ADD COLUMN "sale_id" text REFERENCES "sales_periods"("id"), ADD COLUMN "sale_ends_at" timestamptz`);
    await runner.query(`ALTER TABLE "order_items" ADD COLUMN "sale_id" text REFERENCES "sales_periods"("id")`);
    // Published terms are permanent. Only checkout can decrease remaining availability.
    await runner.query(`CREATE FUNCTION protect_sales_period() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
      IF NEW.id IS DISTINCT FROM OLD.id OR NEW.product_id IS DISTINCT FROM OLD.product_id OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.additional_stock IS DISTINCT FROM OLD.additional_stock OR NEW.starts_at IS DISTINCT FROM OLD.starts_at OR NEW.ends_at IS DISTINCT FROM OLD.ends_at OR NEW.remaining > OLD.remaining THEN
        RAISE EXCEPTION 'Published sales periods are immutable';
      END IF; RETURN NEW; END $$`);
    await runner.query(`CREATE TRIGGER "sales_period_immutable" BEFORE UPDATE ON "sales_periods" FOR EACH ROW EXECUTE FUNCTION protect_sales_period()`);
  }
  async down(runner: QueryRunner): Promise<void> {
    await runner.query(`ALTER TABLE "order_items" DROP COLUMN "sale_id"`);
    await runner.query(`ALTER TABLE "products" DROP COLUMN "sale_id", DROP COLUMN "sale_ends_at"`);
    await runner.query(`DROP TABLE "sales_periods"`);
    await runner.query(`DROP FUNCTION protect_sales_period()`);
  }
}
