-- Normalize the legacy NULL zone representation without guessing how invalid
-- production rows should be repaired. The guards deliberately abort the
-- migration if an operator must resolve invalid numbers/zones or a collision.
CREATE TEMP TABLE "_backend_integrity_guard" (
    "invalidRows" INTEGER NOT NULL CHECK ("invalidRows" = 0)
);

INSERT INTO "_backend_integrity_guard" ("invalidRows")
SELECT COUNT(*)
FROM "Table"
WHERE "number" <= 0
   OR ("zone" IS NOT NULL AND "zone" NOT IN ('outside', 'floor1', 'floor2'));

INSERT INTO "_backend_integrity_guard" ("invalidRows")
SELECT COUNT(*)
FROM (
  SELECT "number", COALESCE("zone", 'outside') AS "normalizedZone"
  FROM "Table"
  GROUP BY "number", COALESCE("zone", 'outside')
  HAVING COUNT(*) > 1
);

DROP TABLE "_backend_integrity_guard";

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Table" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "number" INTEGER NOT NULL,
    "zone" TEXT NOT NULL DEFAULT 'outside',
    "seats" INTEGER DEFAULT 4,
    "name" TEXT,
    "ticketPrintedAt" DATETIME
);

INSERT INTO "new_Table" ("id", "number", "zone", "seats", "name", "ticketPrintedAt")
SELECT
    "id",
    "number",
    COALESCE("zone", 'outside'),
    "seats",
    "name",
    "ticketPrintedAt"
FROM "Table";

DROP TABLE "Table";
ALTER TABLE "new_Table" RENAME TO "Table";
CREATE UNIQUE INDEX "Table_number_zone_key" ON "Table"("number", "zone");

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

ALTER TABLE "PaidTicket" ADD COLUMN "idempotencyKey" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "idempotencyFingerprint" TEXT;

CREATE TABLE "TicketSequence" (
    "series" TEXT NOT NULL PRIMARY KEY,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL
);

INSERT INTO "TicketSequence" ("series", "value", "updatedAt")
SELECT
  'PT',
  COALESCE(MAX(CASE
    WHEN "ticketNumber" GLOB 'PT-[0-9]*' THEN CAST(SUBSTR("ticketNumber", 4) AS INTEGER)
    ELSE 0
  END), 0),
  CURRENT_TIMESTAMP
FROM "PaidTicket";

CREATE UNIQUE INDEX "PaidTicket_idempotencyKey_key" ON "PaidTicket"("idempotencyKey");
CREATE INDEX "Order_tableId_status_idx" ON "Order"("tableId", "status");
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");
CREATE INDEX "OrderItem_menuItemId_idx" ON "OrderItem"("menuItemId");
CREATE INDEX "MenuItem_sku_idx" ON "MenuItem"("sku");
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");
CREATE INDEX "PaidTicketItem_ticketId_idx" ON "PaidTicketItem"("ticketId");
CREATE INDEX "PreOrderItem_sessionId_idx" ON "PreOrderItem"("sessionId");
CREATE INDEX "PreOrderItem_menuItemId_idx" ON "PreOrderItem"("menuItemId");
