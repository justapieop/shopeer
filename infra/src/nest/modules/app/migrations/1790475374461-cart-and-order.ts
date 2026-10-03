import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * Tables for the shopping flow: categories, products, carts, cart items,
 * orders and order items.
 *
 * Money is stored in VND as whole numbers (bigint), never as floating point.
 * The CHECK / UNIQUE constraints are the database's last line of defence
 * against race conditions and bugs:
 *   - products.stock >= 0          → stock can never be oversold
 *   - carts.user_id UNIQUE         → one cart per user
 *   - cart_items (cart_id, product_id) UNIQUE → one line per product in a cart
 */
export class CartAndOrder1790475374461 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "categories" (
                "id"   text PRIMARY KEY,
                "name" text NOT NULL UNIQUE
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "products" (
                "id"          text PRIMARY KEY,
                "name"        text NOT NULL,
                "description" text NOT NULL,
                "price"       bigint NOT NULL CHECK ("price" > 0),
                "category_id" text NOT NULL REFERENCES "categories" ("id"),
                "stock"       integer NOT NULL CHECK ("stock" >= 0),
                "image_url"   text NOT NULL
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_products_category_id" ON "products" ("category_id")`);

        await queryRunner.query(`
            CREATE TABLE "carts" (
                "id"         text PRIMARY KEY,
                "user_id"    text NOT NULL UNIQUE REFERENCES "users" ("id") ON DELETE CASCADE,
                "created_at" timestamptz NOT NULL DEFAULT now(),
                "updated_at" timestamptz NOT NULL DEFAULT now()
            )
        `);

        await queryRunner.query(`
            CREATE TABLE "cart_items" (
                "id"         text PRIMARY KEY,
                "cart_id"    text NOT NULL REFERENCES "carts" ("id") ON DELETE CASCADE,
                "product_id" text NOT NULL REFERENCES "products" ("id") ON DELETE CASCADE,
                "quantity"   integer NOT NULL CHECK ("quantity" > 0),
                CONSTRAINT "UQ_cart_items_cart_product" UNIQUE ("cart_id", "product_id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_cart_items_product_id" ON "cart_items" ("product_id")`);

        await queryRunner.query(`
            CREATE TABLE "orders" (
                "id"           text PRIMARY KEY,
                "user_id"      text NOT NULL REFERENCES "users" ("id"),
                "total_amount" bigint NOT NULL CHECK ("total_amount" > 0),
                "created_at"   timestamptz NOT NULL DEFAULT now()
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_orders_user_id_created_at" ON "orders" ("user_id", "created_at" DESC)`);

        await queryRunner.query(`
            CREATE TABLE "order_items" (
                "id"         text PRIMARY KEY,
                "order_id"   text NOT NULL REFERENCES "orders" ("id") ON DELETE CASCADE,
                "product_id" text NOT NULL REFERENCES "products" ("id"),
                "unit_price" bigint NOT NULL CHECK ("unit_price" > 0),
                "quantity"   integer NOT NULL CHECK ("quantity" > 0),
                CONSTRAINT "UQ_order_items_order_product" UNIQUE ("order_id", "product_id")
            )
        `);
        await queryRunner.query(`CREATE INDEX "IDX_order_items_product_id" ON "order_items" ("product_id")`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE "order_items"`);
        await queryRunner.query(`DROP TABLE "orders"`);
        await queryRunner.query(`DROP TABLE "cart_items"`);
        await queryRunner.query(`DROP TABLE "carts"`);
        await queryRunner.query(`DROP TABLE "products"`);
        await queryRunner.query(`DROP TABLE "categories"`);
    }
}
