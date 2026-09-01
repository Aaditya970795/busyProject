-- CreateIndex
CREATE INDEX "Order_primaryWaiterId_idx" ON "Order"("primaryWaiterId");

-- CreateIndex
CREATE INDEX "Order_tableNumber_idx" ON "Order"("tableNumber");

-- CreateIndex
CREATE INDEX "OrderCollaborator_waiterId_idx" ON "OrderCollaborator"("waiterId");

-- CreateIndex
CREATE INDEX "OrderLine_orderId_idx" ON "OrderLine"("orderId");
