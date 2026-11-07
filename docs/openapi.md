# API documentation

Start the application with `pnpm start:dev`. At the configured `PORT` (3000 by default), documentation is available at:

- `/docs` — Swagger UI, including request examples.
- `/openapi.json` — generated OpenAPI JSON.
- `/openapi.yaml` — generated OpenAPI YAML.

The specification is generated from controller and DTO decorators and covers authentication, public user profiles, products, categories, cart operations, and orders. DTO properties are explicitly annotated because this project builds with `tsc`, without the Swagger CLI plugin.

## Authentication

Registration returns HTTP 409 when the username already exists, including when
another request registers it concurrently. The database's unique username
constraint is authoritative; only one concurrent registration can succeed.

Cart and order operations read the JWT only from the `access_token` cookie.
Call `POST /auth/login` first; it returns HTTP 201 with the public user and sets
an HttpOnly cookie lasting one hour, with `Path=/` and `SameSite=Strict`.
Production cookies also require HTTPS (`Secure`). The token is not returned in
JSON. Bearer headers and user-ID headers are unsupported.

Login also sets an HttpOnly `refresh_token` cookie lasting seven days, scoped to
`Path=/auth/refresh`, with `SameSite=Strict` and `Secure` in production. Both JWTs
are signed with `JWT_SECRET` using HS256 and carry distinct `token_use` claims.
Call `POST /auth/refresh` with the refresh cookie to receive HTTP 200 with the
public user and a new one-hour access cookie, even after the old access token
expires. Missing, invalid, expired, or wrong-purpose tokens return HTTP 401;
deleted users return 401 and suspended users return 403. Refresh tokens cannot
authorize protected routes. Existing access tokens without `token_use` remain
valid until they expire.

Refresh tokens are stateless and reusable until their original expiry; refreshing
does not rotate or extend them. There is no per-session revocation or replay
detection. Sign in again after seven days.

In Swagger UI, execute login on the same site before calling protected routes;
the browser sends the cookie automatically. The Authorize dialog cannot set an
HttpOnly cookie. Browser clients should send credentials with requests (for
example, `credentials: "include"` with fetch); cross-site requests are blocked by
the cookie's SameSite policy. Command-line clients can use curl's `-c` cookie jar
on login and `-b` on subsequent requests. REST Client examples use its cookie jar.

User, registration, and login responses contain only `id`, `username`, `createdAt`, and `suspended`. Password hashes and the domain object's `details` are excluded.

## Order views and product sellers

Buyer routes `GET /orders` and `GET /orders/:orderId` require `Buy` and return only
orders purchased by the authenticated user. Seller routes `GET /seller/orders`
and `GET /seller/orders/:orderId` require `Sell` and return only lines assigned to
that seller at checkout, with a total for those lines only. Lists accept `page`
and `limit` and sort newest first. A reference outside the caller's ownership
returns 404. Super satisfies the permission guard but still receives only its
own buyer/seller projection; these are not administrative all-order routes.
Order reads set `Cache-Control: no-store` and include the persisted `status`,
product-name/image snapshots, quantities and purchase prices.

`PUT /admin/products/:productId/seller` requires `Super` and a JSON body
`{ "sellerId": "user-id" }`. The target must exist, be active, and have `Sell`.
The transaction updates only product ownership, preserving stock and price.
Existing products and historical order lines remain unassigned after the seller
migration. Assigning or reassigning a product affects future orders only; it does
not reveal historical orders to the new seller. Historical names/images are
backfilled from existing products where available. Checkout rejects and rolls
back a concurrent seller reassignment rather than saving stale ownership.

## Data and errors

Checkout and buyer order endpoints require the `Buy` permission (or `Super`), matching
cart access. Users without that permission receive HTTP 403 before the order use
case runs. Orders retain their lifecycle status in the database: new checkout
orders are `pending`, and reads preserve `pending`, `completed`, or `cancelled`.
The order-status migration preserves existing orders as `completed`, matching
their previous read behavior. The public order response shape is unchanged.

`GET /products` and `GET /orders` accept `page` (default 1) and `limit`
(default 20, maximum 100). Both must be positive integers. Invalid values return
HTTP 400. Responses remain JSON arrays; a page past the end returns `[]`.
For example: `/products?categoryId=books&page=2&limit=10` or `/orders?page=2&limit=10`.
Products sort by name then ID ascending; orders sort by creation time then ID
descending. Offset pages reflect current data, so inserts between requests can
shift the results.

Login requires string credentials containing at least one non-whitespace character.
The username is limited to 256 characters and the password to 1024. Invalid input
returns HTTP 400 before credential lookup. Passwords are used exactly as supplied;
login does not impose registration's password-strength rules.

Prices, subtotals, and totals are integer VND amounts. Dates use ISO 8601 strings in the camelCase `createdAt` field. Cart quantity inputs must be positive integers. Adding to a cart checks stock without reserving it; checkout reserves stock inside a transaction.

Checkout and cart operations lock the parent cart row before reading its lines,
so requests for one cart run sequentially. A quantity edit that waits until
checkout finishes returns 409 when its line has been purchased; a removal of an
absent line returns 404. Quantity edits use an update-only query; a removed or
replaced line cannot be recreated by a stale edit. Explicit additions that
run after checkout are new cart contents. A second checkout of the same emptied
cart returns 409. Stock updates across different buyers remain conditional and
transactional.

Errors contain `statusCode`, `error`, and `message`. Validation can return an array of messages. Stock conflicts additionally contain `productIds`. Route documentation lists the applicable HTTP status codes, including 401/403 for protected routes and 409 for cart or stock conflicts.

Setup follows the [NestJS OpenAPI documentation](https://docs.nestjs.com/openapi/introduction).
