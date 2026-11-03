# Shopeer web

Next.js App Router app in the pnpm workspace.

From the repository root:

```sh
pnpm install
pnpm dev:web
```

Open http://localhost:3001. The API uses port 3000.

```sh
pnpm build:web
pnpm start:web
pnpm --filter @shopeer/web typecheck
```

The root `pnpm build` also builds this app. TypeScript extends the root strict
configuration with Next.js browser and bundler settings. Next.js generates route
types during development, builds, and the `typecheck` script.

Add shared packages as explicit `workspace:*` dependencies before importing them.
