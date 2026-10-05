// Point the app's DB client (src/db/index.ts) at the test branch before any
// test file imports it.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
