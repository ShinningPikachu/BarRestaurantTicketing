ALTER TABLE "PaidTicket" ADD COLUMN "businessName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidTicket" ADD COLUMN "tradeName" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidTicket" ADD COLUMN "businessTaxId" TEXT NOT NULL DEFAULT '';
ALTER TABLE "PaidTicket" ADD COLUMN "businessAddress" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "businessCity" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "businessPhone" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "terminalId" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "cashierName" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "customerName" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "customerTaxId" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'paid';
ALTER TABLE "PaidTicket" ADD COLUMN "relatedTicketNumber" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "pdfFileReference" TEXT;
ALTER TABLE "PaidTicket" ADD COLUMN "auditMetadata" TEXT;

CREATE INDEX "PaidTicket_status_idx" ON "PaidTicket"("status");
