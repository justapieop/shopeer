# Frontend architecture

All work under `apps/web` must follow [Feature-Sliced Design](https://fsd.how/).
These instructions apply strictly to this frontend package. Do not apply FSD to
`apps/api`, `domain`, `case`, `infra`, or other backend code.

## Layers and placement

Use this dependency order, from higher to lower:

`_app → _pages → widgets → features → entities → shared`

- `_app`: application initialization, providers, global styles, and composition.
- `_pages`: page slices; keep screen-specific UI and logic together here.
- `features`: user interactions reused across screens.
- `entities`: reusable business concepts such as products, carts, and users.
- `shared`: infrastructure and UI without business logic.

Start with page-local code. Extract features and entities when reuse warrants it.
Avoid widgets unless their purpose is clear; current FSD guidance discourages
them. Never introduce the deprecated `processes` layer. Add directories only
when they contain real code.

Organize slices by business purpose. Within slices, use purpose-based segments
such as `ui`, `model`, `api`, `lib`, and `config`. Avoid generic dumping grounds
named `components`, `hooks`, `types`, or `utils`. App and Shared have segments
directly, without business slices.

## Import boundaries

- A slice may depend on lower layers, never higher layers or sibling slices.
- App and Shared segments may reference other segments within their own layer.
- Expose explicit public exports through a slice's `index.ts`. Consumers must
  use that entry point, not deep imports. Avoid wildcard exports.
- Within a slice, use relative imports directly to files, not its own barrel.
- For unavoidable entity relationships, use a narrowly scoped `@x` API rather
  than unrestricted cross-imports. Prefer composition in a higher layer.
- Give independent Shared UI components and libraries their own entry points;
  avoid a single barrel exporting all Shared code.

## Next.js integration

Follow the [FSD Next.js guide](https://fsd.how/docs/guides/tech/with-nextjs/).

`src/app` is the existing Next.js App Router directory. Keep route files thin:
they compose or re-export page implementations from `src/_pages/<slice>`.
Put application providers and global styling under `src/_app` as they are
organized or refactored. Use `_app` and `_pages`, not `app` and `pages`, for
FSD layer names to avoid Next.js directory conflicts.

Preserve server/client boundaries. Use Client Components only where needed;
when a slice mixes incompatible runtimes, provide `index.server.ts` for its
server-only exports rather than exposing them to client consumers.

## Repository conventions

- Keep the shared strict TypeScript configuration and browser-specific overrides.
- Use explicit `workspace:*` dependencies for any imported workspace package.
- Consume the API through frontend API modules; do not import backend adapters,
  database code, or NestJS modules into frontend code.
- Use the installed HeroUI v3, Tailwind v4, Lucide, and theme infrastructure.
- After implementation changes, run `pnpm --filter @shopeer/web typecheck` and
  `pnpm build:web` from the repository root.

Reference: [Layers](https://fsd.how/docs/reference/layers/),
[public APIs](https://fsd.how/docs/reference/public-api/),
[cross-imports](https://fsd.how/docs/guides/issues/cross-imports/).
