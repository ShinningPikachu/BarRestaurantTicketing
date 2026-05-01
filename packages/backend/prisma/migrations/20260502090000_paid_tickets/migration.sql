CREATE TABLE "PaidTicket" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ticketNumber" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "tableZone" TEXT NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "taxableBaseCents" INTEGER NOT NULL,
    "vatCents" INTEGER NOT NULL,
    "vatRatePercent" INTEGER NOT NULL,
    "splitPeople" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PaidTicketItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "ticketId" TEXT NOT NULL,
    "orderId" TEXT,
    "orderItemId" INTEGER,
    "menuItemId" INTEGER,
    "name" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPriceCents" INTEGER NOT NULL,
    "totalPriceCents" INTEGER NOT NULL,
    CONSTRAINT "PaidTicketItem_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "PaidTicket" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "PaidTicket_ticketNumber_key" ON "PaidTicket"("ticketNumber");
CREATE INDEX "PaidTicket_tableZone_tableNumber_idx" ON "PaidTicket"("tableZone", "tableNumber");
CREATE INDEX "PaidTicket_createdAt_idx" ON "PaidTicket"("createdAt");
