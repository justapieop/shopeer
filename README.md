# shopeer

See [API documentation](docs/openapi.md) for Swagger UI, OpenAPI specifications, and authentication details.

Backend bán hàng (sản phẩm → giỏ hàng → thanh toán → đơn hàng) viết bằng TypeScript, NestJS và PostgreSQL, theo Clean Architecture.

| Package | Vai trò |
|---|---|
| `domain/` | Đối tượng và luật nghiệp vụ |
| `case/` | Use case và port (interface repository) |
| `infra/` | NestJS: controller, repository TypeORM, migration |
| `apps/api/` | Điểm khởi động server |
| `apps/web/` | Frontend Next.js (App Router) |
| `packages/web-lib/` | Thư viện frontend dùng chung (chưa có implementation) |

## Cần cài sẵn

- Node.js 24 trở lên
- pnpm (`corepack enable` là đủ, phiên bản lấy theo `package.json`)
- Docker Desktop (chạy PostgreSQL)

## Chạy lần đầu

```bash
pnpm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
pnpm db:seed:local        # bật PostgreSQL, tạo bảng, nạp dữ liệu mẫu
pnpm start:dev            # build và chạy server tại http://localhost:3000
```

Mở Docker Desktop trước khi chạy `pnpm db:seed:local`.

Nếu PostgreSQL đã chạy, dùng `pnpm db:seed` để tạo bảng và nạp dữ liệu theo cấu hình `POSTGRES_*` trong `.env`. Lệnh này chỉ biên dịch script database và migration, không build hay khởi động API/frontend và không cần Docker. Chạy lại sẽ đặt lại tồn kho mẫu và tài khoản `owner`.

## Các lệnh

| Lệnh | Việc |
|---|---|
| `pnpm db:up` | Bật PostgreSQL trong Docker |
| `pnpm db:migrate` | Bật PostgreSQL và tạo hoặc cập nhật bảng, không cần chạy server |
| `pnpm db:build` | Chỉ biên dịch script database và migration |
| `pnpm db:seed` | Kết nối PostgreSQL theo `.env`, chạy migration và nạp `infra/seed/dev-seed.sql`, không cần build/chạy hệ thống |
| `pnpm db:seed:local` | Bật PostgreSQL trong Docker rồi chạy `db:seed` |
| `pnpm build` | Build tất cả package |
| `pnpm start` | Chạy server đã build |
| `pnpm start:dev` | Build rồi chạy server, log dễ đọc |
| `pnpm dev:web` | Chạy frontend tại http://localhost:3001 |
| `pnpm build:web` | Build frontend Next.js |
| `pnpm start:web` | Chạy frontend đã build tại http://localhost:3001 |
| `pnpm test` | Build rồi chạy toàn bộ test |
| `pnpm race 50` | Demo race condition: 50 người cùng thanh toán một sản phẩm chỉ còn 5 chiếc (cần server đang chạy và vừa `pnpm db:seed`) |

Muốn xóa sạch database local: `docker compose down -v`, rồi `pnpm db:seed:local` lại.

## Tài liệu

- [docs/order-completion.md](docs/order-completion.md): xác nhận giao hàng bởi người xử lý và xác nhận nhận hàng bởi người mua
- [docs/cart-checkout.md](docs/cart-checkout.md): luồng giỏ hàng, thanh toán và cách xử lý race condition
- [docs/requests.http](docs/requests.http): gọi thử API bằng extension REST Client của VS Code
