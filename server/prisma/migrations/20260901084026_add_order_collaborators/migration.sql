-- CreateTable
CREATE TABLE "OrderCollaborator" (
    "orderId" TEXT NOT NULL,
    "waiterId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderCollaborator_pkey" PRIMARY KEY ("orderId","waiterId")
);

-- AddForeignKey
ALTER TABLE "OrderCollaborator" ADD CONSTRAINT "OrderCollaborator_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderCollaborator" ADD CONSTRAINT "OrderCollaborator_waiterId_fkey" FOREIGN KEY ("waiterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
