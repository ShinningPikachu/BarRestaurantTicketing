-- Preserve every historical workflow row. If an older database contains more
-- than one draft for a table, stop and require an operator to reconcile it;
-- silently merging sessions can duplicate quantities and deleting sessions
-- destroys audit context.
CREATE TEMP TABLE "_workflow_integrity_guard" (
    "duplicateDraftTables" INTEGER NOT NULL CHECK ("duplicateDraftTables" = 0)
);

INSERT INTO "_workflow_integrity_guard" ("duplicateDraftTables")
SELECT COUNT(*)
FROM (
  SELECT "tableId"
  FROM "PreOrderSession"
  WHERE "status" = 'draft'
  GROUP BY "tableId"
  HAVING COUNT(*) > 1
);

DROP TABLE "_workflow_integrity_guard";

CREATE UNIQUE INDEX "PreOrderSession_one_draft_per_table_idx"
ON "PreOrderSession"("tableId")
WHERE "status" = 'draft';

-- KitchenTicket, KitchenTicketItem, and User are no longer application models,
-- but their legacy tables are intentionally retained so an upgrade never
-- deletes historical production information.
