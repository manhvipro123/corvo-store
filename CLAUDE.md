# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Scope

A deliberately minimal ecommerce storefront. The database covers categories, products, stock and Better Auth email/password accounts with an admin role. There is a cookie-based bag, Stripe Checkout, an account order history (no refunds) and a small admin area (`/admin`: products, categories, inventory, read-only orders). Do not add social login, password reset, email verification, 2FA, refunds, wishlists, reviews, warehouses, product variants, an admin dashboard/analytics, product deletion, image uploads or finer-grained admin roles unless explicitly asked.

## Verifying changes

Verify with `npm run lint && npm run typecheck && npm test && npm run build`; run `npm run test:db` when touching queries or the schema. `typecheck` runs `next typegen` first so `PageProps<"/new/route">` exists for new routes. `next build` and `next start` need `DATABASE_URL`, `BETTER_AUTH_SECRET` and `BETTER_AUTH_URL`; checkout also needs `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` and `NEXT_PUBLIC_SITE_URL` at runtime, and the stale-checkout cron route `CRON_SECRET`. Set `REQUIRE_DB_TESTS=1` where `test:db` must not silently skip. `next dev` writes server and browser logs (errors, LCP warnings) to `.next/dev/logs/next-development.log`; check it after exercising a page.

## Conventions

- Site name, description and nav links come only from `src/config/site.ts`; don't hardcode them elsewhere.
- The root layout sets a title template, so pages export only `metadata.title`, not the full title.
- For layout/page props, use Next's generated global types `LayoutProps<"/route">` / `PageProps<"/route">` rather than hand-written interfaces.
- Tailwind is v4: there is no `tailwind.config.*`. Theme changes go in `src/app/globals.css` (`:root` tokens + `@theme inline`). Use the token classes (`bg-background`, `text-foreground`, `text-muted`, `bg-surface`, `border-border`) rather than raw colors so dark mode keeps working.
- Visual language: monochrome, square corners (no `rounded-*`), hairline 1px borders, uppercase bold for headings/buttons. Use the type-role utilities (`text-display`, `text-title`, `text-heading`, `text-label`, `text-body`, `text-meta`) instead of raw font sizes, and the primitives in `src/components/ui/` (`Button`/`buttonVariants`, `TextLink`, `Container`, `Section`, `Grid`, `MediaFrame`).
- When adding a new `text-*` utility in `globals.css`, also register it in the `font-size` group in `src/lib/utils.ts`, otherwise `cn()` treats it as a text color and drops it.
- Remote images go through `next/image` and their host must be in `images.remotePatterns` in `next.config.ts` (currently only Unsplash; build URLs with `unsplash()` in `src/lib/images.ts`). In Next 16 use `preload` for a single LCP image (e.g. the hero) — `priority` is deprecated. In grids and lists, where several images could be the LCP, load the first row with `loading="eager"` instead (`eager` on `ProductCard` / `ProductShowcase` / `ProductImage`).
- `/products` filter state lives only in the URL (`?category=&color=a,b&sort=`). Parse and build hrefs with `src/lib/catalog.ts` (`parseFilters`, `filtersHref`, `categoryHref`) rather than hand-writing query strings; filtering/sorting happens in SQL. Filter controls are links, not client state.
- Empty states follow one pattern: a `text-title` line, an optional `text-body text-muted` sentence, then a secondary `buttonVariants` link.
- Product rows that can be shorter than a full grid row end with the "Shop all" `ViewAllTile` (`ProductShowcase` `viewAll`), which stretches to fill the row; never leave empty grid slots.
- A CSS grid that contains a horizontal scroller (e.g. tab rows) needs `grid-cols-[minmax(0,1fr)]`, or the scroller's width stretches the column past the page gutter on mobile.
- `Container` takes `inset="page" | "tile" | "bleed"`. Titles/toolbars directly above an edge-to-edge product `Grid` use `tile` so they align with card captions.
- Render product shots with `ProductImage` (`src/components/product/product-image.tsx`), not raw `next/image`. Source photos have mixed aspect ratios, so each `ImageAsset` sets `fit`: leave the default `contain` for cut-outs and landscape shots, set `"cover"` only for portrait photos with their own backdrop. The detail-page gallery always forces `contain`. Contained shots sit on the `stage` token, which stays light in dark mode on purpose: `multiply` removes the photos' white backdrops only against a light colour, so don't switch it to `surface`.

## Database (Neon Postgres + Drizzle)

- Read `process.env.DATABASE_URL` directly; never load `.env` files in code (no `dotenv`). Next loads them for the app; CLI scripts get them from `node --env-file-if-exists=.env.local` in `package.json`, so run DB tools via the npm scripts.
- Pages and components read data only through `src/db/queries.ts`, which returns the UI types from `src/types/catalog.ts`; don't query Drizzle tables from components. DB modules are `server-only`, so client components get data via props.
- Prices are integer cents, USD only (no currency column). Never store floats.
- Stock lives in `product_stock` (1–1 with products), not on `products`. Every product has a stock row (`createProduct` and migration `0004` guarantee it); reads still `coalesce` to 0. Stock status (in/low/sold out) is derived by `getStockStatus`, never stored.
- Every change to `product_stock.quantity` writes a `stock_movements` row (`initial`, `admin_set`, `admin_adjust`, `reserve`, `release`) in the same statement or `db.batch`, so per product `sum(delta)` equals `quantity`; `tests/db/inventory.test.ts` checks this. Never update `product_stock` without its history row, and never edit or delete history rows.
- `position` (products and categories) is the merchant-set, global "Recommended" order, not personalisation. Leave gaps (10, 20, …) so items can be slotted in.
- Not in the DB on purpose: colour labels/swatches (`src/lib/colors.ts`, must match the `product_color` enum), editorial copy and homepage picks (`src/data/collections.ts`).
- Schema changes: edit `schema.ts` → `npm run db:generate -- --name <change>` → commit `drizzle/` → `npm run db:migrate`. Never `drizzle-kit push`.
- The `neon-http` driver has no interactive transactions; use `db.batch([...])` for atomic writes.
- `npm run db:seed` truncates and reloads all catalog tables, plus `orders`/`order_items` (product ids restart): dev/test only. `TEST_DATABASE_URL` must be a separate Neon branch; `test:db` truncates and reseeds it on every run.
- Scripts run outside Next (seed, test setup) must create their own Drizzle client; importing `src/db/index.ts` throws there (`server-only`).
- `/`, `/products/[slug]`, `/new-arrivals` and `/categories` revalidate every 60s, so DB edits show there within a minute; `/products` and `/search` read live.

## Auth (Better Auth)

- Every protected page or Server Action calls `requireUser(path)` / `requireAdmin(path)` itself. `src/proxy.ts` is only an optimistic cookie check, and a check in a layout alone isn't enough.
- Non-admins get a 404 from admin routes, not a redirect, so their existence isn't revealed.
- Never read the session in the header, root layout or cached pages (`/`, `/products/[slug]`, `/new-arrivals`, `/categories`); it makes them dynamic. Link to `/account` instead.
- No auth client in the browser: all auth flows are Server Actions calling `auth.api.*`. `nextCookies()` stays the last plugin, and `callbackURL` redirects go through `safeCallbackURL`.
- A Server Action's re-render still sees the request's old cookie, so don't replace the current session mid-action (e.g. `changePassword({ revokeOtherSessions: true })`); call `revokeOtherSessions` separately.
- Sign-in errors stay generic ("Email or password is incorrect") so they don't reveal which emails exist. Field rules live in `src/lib/auth-validation.ts`, shared by forms, actions and Better Auth's limits.
- `cookieCache` is off on purpose: every session read hits the DB, so role and ban changes apply immediately.
- After changing `src/lib/auth-options.ts`: `npm run auth:generate` → `npm run db:generate -- --name <change>` → `npm run db:migrate`.
- Auth tables use text ids and aren't related to catalog tables; `db:seed` never touches them. Bootstrap the first admin with `npm run auth:make-admin -- <email>`.

## Bag

- The bag is the httpOnly `corvo_bag` cookie holding only product ids and quantities. Never put prices, names or stock in it; always re-check with `loadBag()` / `buildBag` against the DB.
- Only Server Actions can write it; `/bag` shows the normalised bag and the next action stores it. The header never reads the bag on the server (cached pages would turn dynamic): its count comes from the client-readable `corvo_bag_count` cookie that `writeBag` sets, and `BagCountSync` on `/bag` corrects it.
- Stock checks in the bag are advisory, not reservations; checkout reserves (below). Each line is capped at live stock and `MAX_LINE_QUANTITY` (`lineLimit` in `src/lib/bag.ts`), so one checkout can't hold a product's whole stock.

## Checkout (Stripe)

- Never trust the browser for prices or payment status. Line items use `price_data` from DB prices (no Stripe Products/Prices); only the signature-verified webhook confirms payment. `/checkout/success` only reads the order (by session id + user) and polls; the paid order's pieces are taken out of the bag once the DB shows it paid/processing (again when the next checkout starts, in case the success page never ran), keeping pieces added since.
- Checkout requires sign-in; orders always belong to a user.
- Stock is reserved when checkout starts, not at payment: one `db.batch` inserts the order and decrements each line (sorted by product id); the `quantity >= 0` check rolls it all back. The hold lasts 30 minutes (Stripe's minimum `expires_at`).
- Order moves are conditional on the current status, so replayed or out-of-order events are no-ops; release stock only via `releaseOrder` (releases at most once). Record each event in `stripe_events` in the same batch as its effect.
- Never mark an order paid outside the webhook. Release a pending order's stock yourself only after Stripe confirms its session expired, or answers `resource_missing` for it (`cancelPendingCheckout`).
- One pending checkout per user: `startCheckout` ends the user's earlier pending orders found in the DB (not via the `corvo_checkout` cookie). Orders without a session yet are skipped (another request is creating it), and `attachCheckoutSession` refuses an order that ended meanwhile. If Stripe reports an earlier session complete, checkout stops so the bag isn't charged twice.
- Every session passes `managed_payments: { enabled: false }`: new Stripe accounts default to Managed Payments, which rejects shipping address collection. Don't enable `automatic_tax` (no tax registration).
- Use a restricted key (`rk_`, Checkout Sessions: Write). The webhook route stays out of the proxy matcher; its signature is its auth.
- Locally, the Stripe CLI needs explicit events: `stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook`, and its `whsec_…` goes in `STRIPE_WEBHOOK_SECRET`.

## Admin

- Three layers, and only the last two are security: `src/proxy.ts` (optimistic cookie redirect), `requireAdmin(path)` at the top of every page, and `requireAdmin(path)` as the first line of every Server Action in `src/app/admin/**/actions.ts`, before reading the form or the DB. `admin/layout.tsx` only renders the nav; it is not a check. Server Actions are public POST endpoints callable from any page, so hiding admin links or the proxy protects nothing. `tests/admin-actions.test.ts` discovers every export of `src/app/admin/**/actions.ts` and asserts it refuses non-admins before writing, mocking every write module (and making `@/db` throw); a new write module must be mocked there too; `tests/admin-access.test.ts` covers `requireAdmin`, the layout and a guard in every admin `page.tsx`.
- Reads are the "Admin" section of `src/db/queries.ts` (not user-scoped; never use them on customer pages). Writes live in `src/db/catalog-admin.ts`, which maps constraint failures to typed errors (`UniqueViolationError`, `CategoryInUseError`, `StockChangedError`, …) that actions turn into form errors.
- Form rules live in `src/lib/admin-validation.ts`, shared by the client forms (checked on submit) and the actions. Prices are entered in dollars and parsed as text to cents; image URLs must be on the `images.unsplash.com` host allowed in `next.config.ts`.
- Two stock writes: `setStock` (a physical count) writes only if the quantity still equals what the admin saw (`expected`), so a checkout reserving or returning units meanwhile isn't overwritten; `adjustStock` (received / written off) adds a delta and needs no `expected`. Both are bounded by `quantity >= 0` and `STOCK_MAX`, and record the admin from `requireAdmin`'s session, never from the form.
- "Sold out" means available = 0. Units held by open checkouts were already deducted and come back if those checkouts end unpaid; the UI says so. Inventory shows `available`, `onHold` (pending, within the reservation), `staleHolds` (pending past it) and `processing`.
- Expired checkouts whose `expired` webhook never came are released by `releaseStalePendingOrders` (5 min grace, release only once Stripe confirms the session expired, or answers `resource_missing` for it, e.g. a test-mode session after switching to live keys), run by `/api/cron/release-expired` (`Authorization: Bearer $CRON_SECRET`; `vercel.json` schedules it every 10 min, which needs Vercel Pro; Hobby allows daily) and by the "Release expired holds" button on `/admin/inventory`. Any stock release calls `revalidateStorefront()`. A stale order whose session Stripe reports `complete` lost its `completed` webhook: the sweep never releases or marks it paid, it sets `orders.reconcile_needed_at` (skipped by later runs, shown separately on `/admin/inventory`), and only a resent webhook settles it. The banner count and the sweep share `staleCutoff()` (`src/lib/checkout.ts`).
- Admins never change order status, prices or stock of an order: those stay webhook-only. The orders screens are read-only.
- After a catalog write call `revalidateStorefront()` (`src/lib/storefront-cache.ts`) so the 60s ISR pages update at once.
- In Drizzle single-table selects, columns render unqualified, so a correlated subquery like `products.category_id = categories.id` silently compares two `products` columns; use a join + `groupBy` instead. `ON DELETE RESTRICT` raises `23001`, not `23503`.

## Orders (account)

- Order reads are scoped to the user in the SQL itself (`getOrdersForUser`, `getOrderForUser`), never filtered afterwards; another customer's order is a 404, same as a missing one.
- History shows only `paid`, `processing` and `failed` (`HISTORY_STATUSES` in `src/lib/orders.ts`); `pending`/`expired` are unpaid checkout attempts and 404 on the detail page too.
- Show `order_items` snapshots (name, SKU, unit price as charged), never current product prices.
- Render order dates with `OrderDate` (viewer's time zone); formatting on the server in UTC shows the wrong day for late-evening orders.
