/**
 * CLI for `npm run db:seed`. An .mts file so tsx runs it as ESM (top-level
 * await); the package itself is CommonJS.
 *
 *   npm run db:seed                       # uses DATABASE_URL
 *   SEED_DATABASE_URL=... npm run db:seed # e.g. another branch
 */
import { seed } from "./seed";

const url = process.env.SEED_DATABASE_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL (or SEED_DATABASE_URL).");

const counts = await seed(url);
console.log(
  `Seeded ${counts.categories} categories and ${counts.products} products.`,
);
