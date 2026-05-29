ALTER TABLE "MenuItem" ADD COLUMN "primaryName" TEXT;
ALTER TABLE "MenuItem" ADD COLUMN "secondaryName" TEXT;

ALTER TABLE "PreOrderItem" ADD COLUMN "primaryName" TEXT;
ALTER TABLE "PreOrderItem" ADD COLUMN "secondaryName" TEXT;

ALTER TABLE "OrderItem" ADD COLUMN "primaryName" TEXT;
ALTER TABLE "OrderItem" ADD COLUMN "secondaryName" TEXT;

ALTER TABLE "PaidTicketItem" ADD COLUMN "primaryName" TEXT;
ALTER TABLE "PaidTicketItem" ADD COLUMN "secondaryName" TEXT;

ALTER TABLE "KitchenTicketItem" ADD COLUMN "primaryName" TEXT;
ALTER TABLE "KitchenTicketItem" ADD COLUMN "secondaryName" TEXT;
