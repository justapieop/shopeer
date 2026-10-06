-- Sample data for local development and demos.
-- Loaded by `pnpm db:seed` (infra/src/database/seed.ts), which starts the
-- database and runs the migrations first, so the tables always exist.
-- Safe to run again: it resets these products (including their stock).

BEGIN;

INSERT INTO "categories" ("id", "name") VALUES
    ('cat-fashion',     'Thời trang'),
    ('cat-electronics', 'Điện tử'),
    ('cat-books',       'Sách')
ON CONFLICT ("id") DO UPDATE SET "name" = EXCLUDED."name";

INSERT INTO "products" ("id", "name", "description", "price", "category_id", "stock", "image_url") VALUES
    ('prod-tshirt',     'Áo thun basic',        'Áo thun cotton 100%, nhiều màu',            149000, 'cat-fashion',     100, 'https://picsum.photos/seed/tshirt/400'),
    ('prod-sneaker',    'Giày sneaker trắng',   'Giày sneaker unisex, đế cao su',             590000, 'cat-fashion',      20, 'https://picsum.photos/seed/sneaker/400'),
    ('prod-earbuds',    'Tai nghe bluetooth',   'Tai nghe không dây, pin 24 giờ',             399000, 'cat-electronics',  30, 'https://picsum.photos/seed/earbuds/400'),
    ('prod-flash-sale', 'Điện thoại flash sale','Chỉ còn 5 chiếc: dùng để thử race condition', 1000000, 'cat-electronics',   5, 'https://picsum.photos/seed/phone/400'),
    ('prod-last-one',   'Sách bản giới hạn',    'Chỉ còn đúng 1 cuốn',                         250000, 'cat-books',         1, 'https://picsum.photos/seed/book/400'),
    ('prod-clean-code', 'Clean Architecture',   'Sách của Robert C. Martin',                  320000, 'cat-books',        50, 'https://picsum.photos/seed/clean/400')
ON CONFLICT ("id") DO UPDATE SET
    "name"        = EXCLUDED."name",
    "description" = EXCLUDED."description",
    "price"       = EXCLUDED."price",
    "category_id" = EXCLUDED."category_id",
    "stock"       = EXCLUDED."stock",
    "image_url"   = EXCLUDED."image_url";

COMMIT;
