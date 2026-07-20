-- Persist destructive-operation idempotency keys so a lost response or rapid
-- retry cannot apply the same removal twice.
CREATE TABLE "MutationReceipt" (
    "idempotencyKey" TEXT NOT NULL PRIMARY KEY,
    "fingerprint" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "tableZone" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "MutationReceipt_createdAt_idx" ON "MutationReceipt"("createdAt");
