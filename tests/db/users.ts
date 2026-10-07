import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

/**
 * Throwaway customers whose ids start with `prefix`. A user can hold only
 * one pending order (`orders_one_pending_per_user_idx`), so tests that keep
 * several checkouts open give each its own `shopper()`. `cleanup` deletes
 * their orders, then them.
 */
export function testUsers(sql: Sql, prefix: string) {
  return {
    async shopper(name = "Test Shopper") {
      const id = `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
      await sql`insert into users (id, name, email, created_at, updated_at)
                values (${id}, ${name}, ${`${id}@example.test`}, now(), now())`;
      return id;
    },
    async cleanup() {
      await sql`delete from orders where user_id like ${`${prefix}-%`}`;
      await sql`delete from users where id like ${`${prefix}-%`}`;
    },
  };
}
