-- CreateIndex
CREATE INDEX "transactions_walletId_type_createdAt_idx" ON "transactions"("walletId", "type", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_walletId_createdAt_idx" ON "transactions"("walletId", "createdAt");
