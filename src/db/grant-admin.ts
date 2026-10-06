import { neon } from "@neondatabase/serverless";

/**
 * Gives an existing user the admin role (Better Auth admin plugin `role`).
 * Bootstraps the first admin, since the plugin's setRole endpoint itself
 * requires an admin. Own client: src/db/index.ts is server-only.
 */
export async function grantAdmin(url: string, email: string) {
  const sql = neon(url);
  const rows = await sql`
    update users set role = 'admin', updated_at = now()
    where lower(email) = lower(${email.trim()})
    returning id, email`;
  if (!rows.length) throw new Error(`No user with email ${email}.`);
  return rows[0] as { id: string; email: string };
}
