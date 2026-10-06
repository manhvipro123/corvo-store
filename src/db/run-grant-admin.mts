/**
 * CLI for `npm run auth:make-admin -- <email>`. An .mts file so tsx runs it
 * as ESM (top-level await).
 */
import { grantAdmin } from "./grant-admin";

const email = process.argv[2];
if (!email) throw new Error("Usage: npm run auth:make-admin -- <email>");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

const user = await grantAdmin(process.env.DATABASE_URL, email);
console.log(`${user.email} is now an admin.`);
