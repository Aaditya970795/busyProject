-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "alertAcknowledgedById" TEXT;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_alertAcknowledgedById_fkey" FOREIGN KEY ("alertAcknowledgedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
