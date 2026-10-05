# Corvo

Corvo is a minimal ecommerce storefront built with Next.js (App Router), TypeScript and Tailwind CSS v4.

## Getting started

```bash
npm install
cp .env.example .env.local   # then set DATABASE_URL (Neon)
npm run db:migrate           # create tables
npm run db:seed              # load sample catalog
npm run dev
```

Open http://localhost:3000.

## Scripts

| Script                | Purpose                                      |
| --------------------- | -------------------------------------------- |
| `npm run dev`         | Start the dev server                         |
| `npm run build`       | Production build                             |
| `npm run start`       | Serve the production build                   |
| `npm run lint`        | ESLint                                       |
| `npm run typecheck`   | TypeScript type check                        |
| `npm run format`      | Prettier (+ Tailwind sort)                   |
| `npm test`            | Unit tests (no database)                     |
| `npm run test:db`     | Query tests on `TEST_DATABASE_URL`           |
| `npm run db:generate` | Generate a migration from `src/db/schema.ts` |
| `npm run db:migrate`  | Apply migrations in `drizzle/`               |
| `npm run db:seed`     | Reset and load sample data (dev/test only)   |
| `npm run db:studio`   | Browse/edit data in Drizzle Studio           |

## Structure

```
src/
  app/                # Routes (App Router)
    layout.tsx        # Root layout: header, main, footer
    page.tsx          # Home
    products/page.tsx # Shop placeholder
  components/
    layout/           # Site header & footer
    ui/               # Reusable UI primitives
  config/site.ts      # Site name, description, nav
  db/                 # Drizzle schema, Neon client, queries, seed
drizzle/              # Generated SQL migrations
  lib/utils.ts        # cn() class-name helper
```
