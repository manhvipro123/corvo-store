import type { NeonQueryFunction } from "@neondatabase/serverless";

type Sql = NeonQueryFunction<false, false>;

/**
 * Test setup that puts a product's stock at `quantity` the way the app
 * would: the change and its history row in one statement, so per product
 * sum(delta) still equals quantity (checked after the whole db run).
 */
export async function setTestStock(sql: Sql, productId: number, quantity: number) {
  await sql`
    with old as (
      select quantity from product_stock where product_id = ${productId}
    ),
    upserted as (
      insert into product_stock (product_id, quantity)
      values (${productId}, ${quantity})
      on conflict (product_id) do update set quantity = excluded.quantity, updated_at = now()
      returning quantity
    )
    insert into stock_movements (product_id, delta, quantity_after, reason, note)
    select ${productId}, u.quantity - coalesce((select quantity from old), 0),
           u.quantity, 'admin_set', 'Test setup'
    from upserted u
    where u.quantity <> coalesce((select quantity from old), 0)`;
}

/** Removes a product's stock row (legacy "no row" state), keeping the ledger at 0. */
export async function deleteTestStock(sql: Sql, productId: number) {
  await sql`
    with gone as (
      delete from product_stock where product_id = ${productId}
      returning quantity
    )
    insert into stock_movements (product_id, delta, quantity_after, reason, note)
    select ${productId}, -quantity, 0, 'admin_set', 'Test setup'
    from gone
    where quantity > 0`;
}

/**
 * Products whose history doesn't add up to their stock (a missing stock row
 * counts as 0). Empty when every stock change wrote its history row.
 */
export function ledgerMismatches(sql: Sql) {
  return sql`
    select p.id, coalesce(s.quantity, 0) as quantity,
           coalesce((select sum(m.delta) from stock_movements m
                     where m.product_id = p.id), 0)::int as total
    from products p
    left join product_stock s on s.product_id = p.id
    where coalesce(s.quantity, 0) <> coalesce((select sum(m.delta) from stock_movements m
                                               where m.product_id = p.id), 0)`;
}
