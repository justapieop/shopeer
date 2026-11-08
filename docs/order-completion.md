# Order completion

New orders follow a two-step completion protocol:

1. `pending`: checkout succeeded; delivery has not been confirmed.
2. `delivered`: a handler confirmed that the package was delivered. The order is waiting for the buyer's confirmation.
3. `completed`: the buyer confirmed that the package was received.

`cancelled` orders cannot advance through this protocol. Historical completed orders remain completed when the migration is applied.

## Handler confirmation

`POST /handler/orders/:orderId/confirm-delivery`

Requires an authenticated, active user with `EditAnyOrder`: the preset roles `order_handler`, `admin`, and `owner` qualify. No request body is needed. A seller's `Sell` permission alone does not grant handler authority.

This moves an order from `pending` to `delivered`. Repeating the request for an already delivered or completed order returns its current state without moving it backward. The endpoint is available in Swagger UI at `/docs/`.

Handlers can use **Handler orders** in the store or order navigation to open `/handler/orders`. The delivery queue defaults to orders awaiting delivery, with filters for awaiting buyer receipt, completed, cancelled, and all orders. Each order links to its full details. **Confirm delivery** updates the order and refreshes the queue; a delivered order waits for the buyer's receipt confirmation.

The queue uses `GET /handler/orders` with pagination and an optional `status` filter. `GET /handler/orders/:orderId` returns full order details. Both require `EditAnyOrder`, reject suspended users, and disable response caching. Signing in returns handlers to the queue or the order they opened.

## Buyer confirmation

`POST /orders/:orderId/confirm-receipt`

Requires an authenticated, active user with `Buy` who owns the order. No request body is needed. This moves `delivered` to `completed`; attempting it before delivery confirmation returns HTTP 409. Another buyer's order is reported as HTTP 404. Repeating a successful confirmation returns the completed order.

Buyers can use **Confirm receipt** on delivered orders in their order list or order details. Seller order views display that the order is awaiting the buyer's confirmation.

Both endpoints return the updated order with HTTP 200. Status writes use a transaction and an atomic comparison with the expected previous state, so duplicate or stale requests cannot overwrite a later state. Confirmations do not change stock, order items, purchase prices, or checkout-time ownership.

The new database migration adds `delivered` to the status constraint. It runs through the normal migration runner, including `pnpm db:seed`, or on API startup. Rolling it back changes orders awaiting receipt confirmation to `pending` before restoring the old constraint.
