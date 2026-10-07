-- Every product gets a stock row (a missing row used to mean "sold out"),
-- so stock writes can rely on the row existing.
INSERT INTO "product_stock" ("product_id", "quantity")
SELECT "id", 0 FROM "products"
WHERE NOT EXISTS (
	SELECT 1 FROM "product_stock" WHERE "product_stock"."product_id" = "products"."id"
);
--> statement-breakpoint
-- Opening balance, so sum(delta) per product equals its current quantity.
INSERT INTO "stock_movements" ("product_id", "delta", "quantity_after", "reason", "note")
SELECT "product_id", "quantity", "quantity", 'initial', 'Opening balance'
FROM "product_stock"
WHERE "quantity" > 0
	AND NOT EXISTS (
		SELECT 1 FROM "stock_movements" WHERE "stock_movements"."product_id" = "product_stock"."product_id"
	);
