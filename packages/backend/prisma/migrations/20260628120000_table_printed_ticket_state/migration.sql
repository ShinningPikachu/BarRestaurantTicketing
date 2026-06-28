-- Persist whether a customer ticket has been printed for an active table workflow.
ALTER TABLE "Table" ADD COLUMN "ticketPrintedAt" DATETIME;
