# @shopeer/web-lib

Empty frontend library workspace. Define its purpose and public exports in
`src/index.ts` when needed.

`apps/web` declares a `workspace:*` dependency on this package. It exports
TypeScript source, which Next.js compiles through `transpilePackages`; no separate
library build is needed to start the frontend.

The package inherits the monorepo's strict TypeScript settings with browser and
bundler overrides. Its `build` and `typecheck` scripts validate types without
emitting files; the consuming application produces the JavaScript bundle.

```sh
pnpm --filter @shopeer/web-lib typecheck
```
