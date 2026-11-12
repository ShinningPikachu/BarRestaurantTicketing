-- Nullable snapshots preserve every existing historical accounting record.
-- A NULL legacy item rate falls back to the recorded ticket/default rate.
ALTER TABLE "MenuItem" ADD COLUMN "vatRatePercent" INTEGER;
ALTER TABLE "PreOrderItem" ADD COLUMN "vatRatePercent" INTEGER;
ALTER TABLE "OrderItem" ADD COLUMN "vatRatePercent" INTEGER;
ALTER TABLE "PaidTicketItem" ADD COLUMN "vatRatePercent" INTEGER;
ALTER TABLE "PaidTicket" ADD COLUMN "taxBreakdownJson" TEXT;
