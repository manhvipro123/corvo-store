# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Scope

A deliberately minimal ecommerce storefront. The database covers only categories, products and stock. Do not add auth, cart, orders, payments, wishlists, reviews, warehouses, product variants or admin features unless explicitly asked.

## Verifying changes

Verify with `npm run lint && npm run typecheck && npm test && npm run build`; run `npm run test:db` when touching queries or the schema. `typecheck` runs `next typegen` first so `PageProps<"/new/route">` exists for new routes. `next build` needs `DATABASE_URL` (pages prerender from the DB).

## Conventions

- Site name, description and nav links come only from `src/config/site.ts`; don't hardcode them elsewhere.
- The root layout sets a title template, so pages export only `metadata.title`, not the full title.
- For layout/page props, use Next's generated global types `LayoutProps<"/route">` / `PageProps<"/route">` rather than hand-written interfaces.
- Tailwind is v4: there is no `tailwind.config.*`. Theme changes go in `src/app/globals.css` (`:root` tokens + `@theme inline`). Use the token classes (`bg-background`, `text-foreground`, `text-muted`, `bg-surface`, `border-border`) rather than raw colors so dark mode keeps working.
- Visual language: monochrome, square corners (no `rounded-*`), hairline 1px borders, uppercase bold for headings/buttons. Use the type-role utilities (`text-display`, `text-title`, `text-heading`, `text-label`, `text-body`, `text-meta`) instead of raw font sizes, and the primitives in `src/components/ui/` (`Button`/`buttonVariants`, `TextLink`, `Container`, `Section`, `Grid`, `MediaFrame`).
- When adding a new `text-*` utility in `globals.css`, also register it in the `font-size` group in `src/lib/utils.ts`, otherwise `cn()` treats it as a text color and drops it.
- Remote images go through `next/image` and their host must be in `images.remotePatterns` in `next.config.ts` (currently only Unsplash; build URLs with `unsplash()` in `src/lib/images.ts`). In Next 16 use `preload` for the LCP image — `priority` is deprecated.
- `/products` filter state lives only in the URL (`?category=&color=a,b&sort=`). Parse and build hrefs with `src/lib/catalog.ts` (`parseFilters`, `filtersHref`, `categoryHref`) rather than hand-writing query strings; filtering/sorting happens in SQL. Filter controls are links, not client state.
- `Container` takes `inset="page" | "tile" | "bleed"`. Titles/toolbars directly above an edge-to-edge product `Grid` use `tile` so they align with card captions.
- Render product shots with `ProductImage` (`src/components/product/product-image.tsx`), not raw `next/image`. Source photos have mixed aspect ratios, so each `ImageAsset` sets `fit`: leave the default `contain` for cut-outs and landscape shots, set `"cover"` only for portrait photos with their own backdrop. The detail-page gallery always forces `contain`.

## Database (Neon Postgres + Drizzle)

- Read `process.env.DATABASE_URL` directly; never load `.env` files in code (no `dotenv`). Next loads them for the app; CLI scripts get them from `node --env-file-if-exists=.env.local` in `package.json`, so run DB tools via the npm scripts.
- Pages and components read data only through `src/db/queries.ts`, which returns the UI types from `src/types/catalog.ts`; don't query Drizzle tables from components. DB modules are `server-only`, so client components get data via props.
- Prices are integer cents, USD only (no currency column). Never store floats.
- Stock lives in `product_stock` (1–1 with products), not on `products`. A missing stock row means sold out. Stock status (in/low/sold out) is derived by `getStockStatus`, never stored.
- `position` (products and categories) is the merchant-set, global "Recommended" order, not personalisation. Leave gaps (10, 20, …) so items can be slotted in.
- Not in the DB on purpose: colour labels/swatches (`src/lib/colors.ts`, must match the `product_color` enum), editorial copy and homepage picks (`src/data/collections.ts`).
- Schema changes: edit `schema.ts` → `npm run db:generate -- --name <change>` → commit `drizzle/` → `npm run db:migrate`. Never `drizzle-kit push`.
- The `neon-http` driver has no interactive transactions; use `db.batch([...])` for atomic writes.
- `npm run db:seed` truncates and reloads all catalog tables: dev/test only. `TEST_DATABASE_URL` must be a separate Neon branch; `test:db` truncates and reseeds it on every run.
- Scripts run outside Next (seed, test setup) must create their own Drizzle client; importing `src/db/index.ts` throws there (`server-only`).
- `/` and `/products/[slug]` revalidate every 60s, so DB edits show there within a minute; `/products` reads live.
