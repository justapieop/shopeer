# API documentation

Start the application with `pnpm start:dev`. At the configured `PORT` (3000 by default), documentation is available at:

- `/docs` — Swagger UI, including request examples and the Authorize dialog.
- `/openapi.json` — generated OpenAPI JSON.
- `/openapi.yaml` — generated OpenAPI YAML.

The specification is generated from controller and DTO decorators and covers all 14 business operations: authentication, public user profiles, products, categories, cart operations, and orders. DTO properties are explicitly annotated because this project builds with `tsc`, without the Swagger CLI plugin.

## Authentication

Cart and order operations require `Authorization: Bearer <JWT>`. Login sets an `access_token` cookie, but the current authentication decorator reads the bearer header only. Enter that JWT in Swagger UI's Authorize dialog to call protected operations. Login currently returns HTTP 201, including the public user and a `Set-Cookie` response header.

User, registration, and login responses contain only `id`, `username`, `createdAt`, and `suspended`. Password hashes and the domain object's `details` are excluded.

## Data and errors

Prices, subtotals, and totals are integer VND amounts. Dates use ISO 8601 strings in the camelCase `createdAt` field. Cart quantity inputs must be positive integers. Adding to a cart checks stock without reserving it; checkout reserves stock inside a transaction.

Errors contain `statusCode`, `error`, and `message`. Validation can return an array of messages. Stock conflicts additionally contain `productIds`. Route documentation lists the applicable HTTP status codes, including 401/403 for protected routes and 409 for cart or stock conflicts.

Setup follows the [NestJS OpenAPI documentation](https://docs.nestjs.com/openapi/introduction).
