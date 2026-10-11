# Unit of Work

Application writes use `UnitOfWork.execute()`. Its cart, cart-item, product, order,
user and category repositories share one transaction. Any error that escapes the
callback rolls everything back; the result is returned only after commit succeeds.

`OrderUseCase.checkout()` includes its reads, stock reservations, order inserts
and cart cleanup in one callback. `CartUseCase` includes cart creation, every edit,
and loading the resulting cart view in its callback. `getCart()` also uses a
transaction because it can create a cart on first use.

`UserUseCase.save()`, `CategoryUseCase.save()` and `CartItemUseCase.save()` write
through callback repositories. Authentication registration reaches this path via
`UserUseCase.save()`; password hashing happens before the transaction. Queries
that do not create or change data use the normal repository providers.

```ts
return unitOfWork.execute(async ({ carts, cartItems, products, orders }) => {
  // All repository operations here use the same transaction.
  // Build and validate an order, then persist it with orders.placeOrder(...).
  return order;
});
```

The application owns `UnitOfWork` and `RepositorySet` in `case/src/ports.ts`.
`infra/src/database/TypeOrmUnitOfWork.ts` implements the port using
`DataSource.transaction()` and constructs adapters from `manager.getRepository()`.
`UnitOfWorkModule` registers and exports one shared provider and registers all
entities needed by its adapters. User, product, cart and order modules import it.
`domain` has no transaction or TypeORM dependency.

Controllers, services and authentication pipes access persistence through
application use cases. Feature modules export their use cases, with `UserPipe`
also exported for authentication. Concrete repository adapters stay inside module
provider wiring and the TypeORM Unit of Work. Migrations and seed scripts are
database administration entry points.

Use only the callback's repositories for transactional work, await all operations,
and let errors escape. Do not retain these repositories after the callback ends.
Every adapter write requires an active transaction, including saves, cart creation,
upserts and deletes. Normal providers and expired callback repositories reject
writes before issuing SQL. `placeOrder()` never opens its own transaction.
Its cart-line locks, sorted product updates, conditional stock decrements and
selective cart cleanup preserve checkout's existing concurrency behavior. Products
added to the cart during checkout remain there if they were not ordered.

This scope covers a single PostgreSQL transaction. Independent `execute()` calls
open independent transactions; compose additional work inside the same callback.
External payments or other services cannot be rolled back by this Unit of Work.

`UnitOfWork<TRepositories>` supports a smaller or extended repository scope.
The existing payment `TransactionUseCase.save()` accepts a Unit of Work exposing
`transactions`. There is currently no PostgreSQL adapter or table for that port;
it must be supplied when payment persistence is implemented. The shared TypeORM
Unit of Work exposes the six repository ports that already have database adapters.

## Schema alignment

The domain requires an order's `cartId`. The additive `order-cart-id` migration
stores it and backfills historical orders from the user's unique cart. If an old
order has no matching cart, the migration fails and rolls back; reconcile that
historical record before rerunning it. Normal application startup and
`pnpm db:migrate` run the migration.

## Verification

`pnpm test` builds the packages, runs application tests with a rollback-capable
in-memory Unit of Work, and checks the TypeORM adapter's manager binding,
transaction lifecycle, commit failures, independent executions, rejected writes
outside a transaction, rollback of cart/user/category/cart-item operations, and
NestJS provider wiring.

Real PostgreSQL checks are opt-in. They create a unique schema, run the actual
migrations, and delete that schema afterward. Provide a PostgreSQL URL for a
database where the test user can create schemas:

```powershell
$env:UOW_TEST_DATABASE_URL = 'postgresql://shopeer:shopeer@localhost:5432/shopeer'
pnpm test
Remove-Item Env:UOW_TEST_DATABASE_URL
```

These checks cover successful checkout and cart edits, user persistence, rollback
across user/category/product repositories, cart edits in another transaction, two
buyers reading the last unit before either reserves it, and migration of a
historical order. They skip when the URL is unset.
