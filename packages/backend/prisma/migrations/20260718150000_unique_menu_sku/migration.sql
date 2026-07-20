-- CSV imports use SKU as the product identity. Do not silently clear a
-- duplicate production SKU: CREATE UNIQUE INDEX fails atomically so the
-- operator can resolve the ambiguous products before retrying.
DROP INDEX IF EXISTS "MenuItem_sku_idx";
CREATE UNIQUE INDEX "MenuItem_sku_key" ON "MenuItem"("sku");
