# shopeer

Backend bán hàng (sản phẩm → giỏ hàng → thanh toán → đơn hàng) viết bằng TypeScript, NestJS và PostgreSQL, theo Clean Architecture.

| Package | Vai trò |
|---|---|
| `domain/` | Đối tượng và luật nghiệp vụ |
| `case/` | Use case và port (interface repository) |
| `infra/` | NestJS: controller, repository TypeORM, migration |
| `app/` | Điểm khởi động server |

## Cần cài sẵn

- Node.js 24 trở lên
- pnpm (`corepack enable` là đủ, phiên bản lấy theo `package.json`)
- Docker Desktop (chạy PostgreSQL)

## Chạy lần đầu

```bash
pnpm install
cp .env.example .env      # Windows PowerShell: Copy-Item .env.example .env
pnpm db:seed              # bật PostgreSQL, tạo bảng, nạp dữ liệu mẫu
pnpm start:dev            # build và chạy server tại http://localhost:3000
```

Mở Docker Desktop trước khi chạy `pnpm db:seed`.

## Các lệnh

| Lệnh | Việc |
|---|---|
| `pnpm db:up` | Bật PostgreSQL trong Docker |
| `pnpm db:migrate` | Bật PostgreSQL và tạo hoặc cập nhật bảng, không cần chạy server |
| `pnpm db:seed` | Như `db:migrate`, rồi nạp dữ liệu mẫu từ `infra/seed/dev-seed.sql`. Chạy lại được bất cứ lúc nào để đặt lại tồn kho |
| `pnpm build` | Build tất cả package |
| `pnpm start` | Chạy server đã build |
| `pnpm start:dev` | Build rồi chạy server, log dễ đọc |
| `pnpm test` | Build rồi chạy toàn bộ test |
| `pnpm race 50` | Demo race condition: 50 người cùng thanh toán một sản phẩm chỉ còn 5 chiếc (cần server đang chạy và vừa `pnpm db:seed`) |

Muốn xóa sạch database local: `docker compose down -v`, rồi `pnpm db:seed` lại.

## Tài liệu

- [docs/cart-checkout.md](docs/cart-checkout.md): luồng giỏ hàng, thanh toán và cách xử lý race condition
- [docs/requests.http](docs/requests.http): gọi thử API bằng extension REST Client của VS Code
