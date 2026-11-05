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
forwarding cookies on subsequent requests. Browser API modules use the shared
typed client at `src/shared/api`, whose base URL is `/api`. The token stays in
the backend's HttpOnly, SameSite=Strict cookie, with a one-hour lifetime.
Production requires HTTPS because the API marks this cookie Secure.
Successful login returns to `/`.

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
