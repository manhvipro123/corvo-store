# Corvo

Corvo is a minimal ecommerce storefront built with Next.js (App Router), TypeScript and Tailwind CSS v4, on Neon Postgres (Drizzle), Better Auth and Stripe Checkout.

Customers can browse and search the catalog, keep a bag, sign in, pay with Stripe and see their order history. Admins manage products, categories and inventory, and view orders (read-only).

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values (see comments in the file)
npm run db:migrate           # create tables
npm run db:seed              # load sample catalog (dev/test only: resets catalog and orders)
npm run dev
```

Open http://localhost:3000.

To use the admin area, create an account at `/sign-up`, then grant it the admin role:

```bash
npm run auth:make-admin -- you@example.com
```

### Stripe locally

Use a Stripe sandbox and a restricted key (`rk_test_…`, Checkout Sessions: Write) for `STRIPE_SECRET_KEY`. Forward webhooks with the Stripe CLI and put the `whsec_…` it prints in `STRIPE_WEBHOOK_SECRET`:

```bash
stripe listen --events checkout.session.completed,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,checkout.session.expired --forward-to localhost:3000/api/stripe/webhook
```

Pay with the test card `4242 4242 4242 4242`, any future expiry and any CVC.

## Scripts

| Script                    | Purpose                                                |
| ------------------------- | ------------------------------------------------------ |
| `npm run dev`             | Start the dev server                                   |
| `npm run build`           | Production build                                       |
| `npm run start`           | Serve the production build                             |
| `npm run lint`            | ESLint                                                 |
| `npm run typecheck`       | Generate route types, then TypeScript type check       |
| `npm run format`          | Prettier (+ Tailwind sort)                             |
| `npm test`                | Unit tests (no database)                               |
| `npm run test:db`         | Database tests on `TEST_DATABASE_URL` (reset each run) |
| `npm run db:generate`     | Generate a migration from `src/db/schema.ts`           |
| `npm run db:migrate`      | Apply migrations in `drizzle/`                         |
| `npm run db:seed`         | Reset and load sample data (dev/test only)             |
| `npm run db:studio`       | Browse/edit data in Drizzle Studio                     |
| `npm run auth:generate`   | Regenerate `src/db/auth-schema.ts` from auth options   |
| `npm run auth:make-admin` | Grant the admin role to an existing account            |

`TEST_DATABASE_URL` must point to a separate Neon branch: `test:db` truncates it.

## Structure

```
src/
  app/                  # Routes (App Router)
    (auth)/             # Sign in, sign up
    account/            # Account details and order history
    admin/              # Products, categories, inventory, orders
    api/                # Stripe webhook, auth handler, expired-checkout cron
    bag/  checkout/     # Bag, Stripe success/cancel pages
    products/ categories/ new-arrivals/ search/
  components/           # UI by area; ui/ holds shared primitives
  config/site.ts        # Site name, description, nav
  data/collections.ts   # Editorial copy and homepage picks
  db/                   # Drizzle schema, queries, writes, seed
  lib/                  # Auth, bag, checkout, validation, helpers
  types/                # UI-facing types
  proxy.ts              # Optimistic auth redirect for protected routes
drizzle/                # Generated SQL migrations
tests/                  # Unit tests; tests/db/ needs a database
```

## Deployment

`vercel.json` runs `/api/cron/release-expired` every 10 minutes to release stock held by abandoned checkouts. That schedule needs Vercel Pro (Hobby allows daily). Set `CRON_SECRET` in the project so the route accepts the call.
