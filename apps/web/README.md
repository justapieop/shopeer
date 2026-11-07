# Shopeer web

Next.js App Router app in the pnpm workspace.

Frontend code follows [Feature-Sliced Design](https://fsd.how/).
See [AGENTS.md](./AGENTS.md) for the frontend-only architecture and import rules,
including the Next.js `_app` / `_pages` layer naming convention.

```text
src/
  app/                    Next.js route entry points
  _app/
    layouts/              Root document layout and metadata
    providers/            App-wide client providers
    styles/               Global styles, Tailwind, and HeroUI imports
  _pages/
    home/
      index.ts            Home slice public API
      ui/                 Home page and scoped styles
```

`@/*` resolves to this app's `src/*`. Import other slices through their public
API; keep relative imports within a slice. Introduce `features`, `entities`, and
`shared` only as actual reusable code needs them.

From the repository root:

```sh
pnpm install
pnpm dev:web
```

Open http://localhost:3000. Run the API on port 3001 (`PORT=3001` in the root `.env`).

Copy `apps/web/.env.example` to `apps/web/.env.local` to override `API_URL`.
It defaults to `http://127.0.0.1:3001` and is server-only. Restart Next.js after
changing it; production builds resolve the rewrite destination at build time.

The `/login` page sends credentials to `/api/auth/login`. Next.js proxies
`/api/:path*` to the backend, passing through its `Set-Cookie` response and
forwarding cookies on subsequent requests. Thin login and refresh Route Handlers
adapt the backend refresh cookie path from `/auth/refresh` to `/api/auth/refresh`;
other API paths use the rewrite. Browser API modules use the shared typed client
at `src/shared/api`, whose base URL is `/api`. Both tokens stay in HttpOnly,
SameSite=Strict cookies: access lasts one hour and refresh lasts seven days.
Production requires HTTPS because the API marks these cookies Secure.
Successful login returns to `/`.

Session state lives in the `entities/session` provider. `useSession()` exposes
the current user, loading/error state, `refresh()`, `setUser()`, and `clearSession()`.
It checks `/api/user/me` once on load and shares a five-minute in-memory cache,
including anonymous results. Navigation, focus, returning to the tab, and reconnecting
only revalidate stale entries; there is no polling. Concurrent checks share one request.
Failures keep the last known user and back off for 30 seconds; explicit retry bypasses
that delay. Login fills the cache directly from its response. A 401 from the shared
API client first makes one shared `POST /api/auth/refresh` attempt, then replays
each rejected request once, preserving its body and credentials. Late 401s from
the same access-cookie generation reuse the completed renewal. Login, registration,
and refresh requests do not trigger recovery. A final 401 clears the session;
a 403 does not. Network failures and server errors do not replay writes or clear
the cached user. Responses from requests made before
a login or session clear cannot overwrite the newer state.

There is no logout endpoint yet. When implementing logout, clear the HttpOnly
cookies on the server before calling `clearSession()`; clearing the client cache
alone does not revoke a session. The cache controls UI only, while protected API
routes continue to authenticate each request. Run `pnpm --filter @shopeer/web test`
for cache and authentication middleware regression coverage.

## Viewing the cart

The store navigation and successful-addition summary link to `/cart`. This page
loads the signed-in user's cart through the shared API client with `cache: "no-store"`.
It shows product images, quantities, current unit prices, line subtotals, the VND
total, and warnings when a quantity exceeds current stock. Empty carts link back
to the store; failed requests offer a retry. Refresh cart fetches current prices
and stock again. Cart viewing does not reserve inventory.

Cart quantities can be edited with Update, products can be removed, and Place
order submits the current cart to `POST /checkout`. Unsaved quantities and
unavailable stock block checkout. Cart controls are disabled during a write,
and double submission is prevented in the page model as well as the buttons.
The server response supplies the final totals; successful checkout shows an
order reference and receipt, then reloads the cart. It does not claim payment
has completed.

HTTP 409 conflicts and removed-line 404 responses reload the latest cart for
review without replaying the write. An uncertain network/server response blocks
further writes until the buyer explicitly refreshes the cart. If reloading fails
after a successful checkout, the order confirmation remains visible. In-flight
reads cannot overwrite newer results, and changing accounts creates a separate
page model.

Cart data stays in page-local memory and is shown only for the account that
loaded it. Anonymous visitors go to `/login?next=cart`; login and refresh recovery
return them to their cart. No private cart content is included in the initial
server-rendered shell.

## Store catalog

`/store` requires a valid session before rendering or fetching the catalog. Missing,
expired, invalid, and suspended access sessions redirect to `/login?next=store`.
That page forces a browser session check, allowing the refresh cookie to renew
access and return to the store without entering credentials. Unrecoverable sessions
remain on the login form. Server Components never try to set cookies during render.
The home-page store link only appears for signed-in users.
Server authorization calls `/user/me` without caching user data, once per store
request (deduplicated within that render). Catalog caching remains independent;
the public product API itself retains its existing access rules. Later client 401s
also hide the store and redirect to login.

The store renders the public catalog through the SDK on the server. Products are
requested 12 at a time using `page` and `categoryId` query parameters. Product
responses are cached by URL for 60 seconds; categories for five minutes. These
public requests omit credentials and do not share the session cache. An eight-second
timeout bounds failed upstream requests. Fetches start in parallel and repeated
calls within a server render are deduplicated.

The initial shell streams with a grid placeholder. Subsequent page and category
changes keep the current products visible until the new results arrive, with an
inline loading state. Links prefetch on hover/focus rather than fetching every
category in the viewport. Below-the-fold images load lazily in fixed-size frames.
Navigation remains usable without JavaScript, including browser back/forward.

The API returns arrays without totals, so the UI uses Previous/Next and only offers
Next after a full page. An exact multiple of 12 may end in an empty final page with
a working Previous link; no extra count or look-ahead request is made. Price and
stock may be up to 60 seconds old; checkout remains authoritative.

Each product has quantity controls and an Add to cart action using the SDK's
`POST /cart/items` through the same-origin proxy. Sold-out products and quantities
beyond known available stock are disabled. Successful responses update the cart
count and total directly, including quantities already in the cart, without another
GET or a catalog refresh. Additions are serialized to keep totals in order and a
pending action cannot be submitted twice. Failed writes are never retried automatically;
the API validates stock and permissions, and session 401s use the existing login flow.

```sh
pnpm build:web
pnpm start:web
pnpm --filter @shopeer/web typecheck
```

The root `pnpm build` also builds this app. TypeScript extends the root strict
configuration with Next.js browser and bundler settings. Next.js generates route
types during development, builds, and the `typecheck` script.

Add shared packages as explicit `workspace:*` dependencies before importing them.
`@shopeer/web-lib` provides the typed OpenAPI client in `packages/web-lib`, already
linked as a dependency and configured for source transpilation by Next.js.

## UI libraries

- HeroUI v3: import components from `@heroui/react`. Styles are loaded globally
  after Tailwind CSS v4; no HeroUI provider is required.
- Tailwind CSS v4: configured through `@tailwindcss/postcss` and `globals.css`.
- `tailwind-variants`: compose reusable variants for custom components.
- `lucide-react`: SVG icons; import individual icons as needed.
- `next-themes`: the root client provider follows the system theme and applies
  `light` / `dark` classes. Use `useTheme()` in client components to change themes.
  Wait until mounted before rendering UI based on the current theme.

HeroUI v3 uses CSS animations and does not require Framer Motion.
