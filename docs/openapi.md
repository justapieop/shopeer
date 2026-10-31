# API documentation

Start the application with `pnpm start:dev`. At the configured `PORT` (3000 by default), documentation is available at:

- `/docs` — Swagger UI, including request examples.
- `/openapi.json` — generated OpenAPI JSON.
- `/openapi.yaml` — generated OpenAPI YAML.

The specification is generated from controller and DTO decorators and covers all 14 business operations: authentication, public user profiles, products, categories, cart operations, and orders. DTO properties are explicitly annotated because this project builds with `tsc`, without the Swagger CLI plugin.

## Authentication

Cart and order operations read the JWT only from the `access_token` cookie.
Call `POST /auth/login` first; it returns HTTP 201 with the public user and sets
an HttpOnly cookie lasting one hour, with `Path=/` and `SameSite=Strict`.
Production cookies also require HTTPS (`Secure`). The token is not returned in
JSON. Bearer headers and user-ID headers are unsupported.

In Swagger UI, execute login on the same site before calling protected routes;
the browser sends the cookie automatically. The Authorize dialog cannot set an
HttpOnly cookie. Browser clients should send credentials with requests (for
example, `credentials: "include"` with fetch); cross-site requests are blocked by
the cookie's SameSite policy. Command-line clients can use curl's `-c` cookie jar
on login and `-b` on subsequent requests. REST Client examples use its cookie jar.

User, registration, and login responses contain only `id`, `username`, `createdAt`, and `suspended`. Password hashes and the domain object's `details` are excluded.

## Data and errors

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

Errors contain `statusCode`, `error`, and `message`. Validation can return an array of messages. Stock conflicts additionally contain `productIds`. Route documentation lists the applicable HTTP status codes, including 401/403 for protected routes and 409 for cart or stock conflicts.

Setup follows the [NestJS OpenAPI documentation](https://docs.nestjs.com/openapi/introduction).
