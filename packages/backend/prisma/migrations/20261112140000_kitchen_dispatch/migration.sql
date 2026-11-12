CREATE TABLE "KitchenDispatch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "orderId" TEXT NOT NULL,
  "tableNumber" INTEGER NOT NULL,
  "tableZone" TEXT NOT NULL,
  "linesJson" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "printerJobId" TEXT,
  "lastErrorCode" TEXT,
  "acknowledgedAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX "KitchenDispatch_orderId_key" ON "KitchenDispatch"("orderId");
CREATE INDEX "KitchenDispatch_status_createdAt_idx" ON "KitchenDispatch"("status", "createdAt");
