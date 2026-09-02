-- CreateEnum
CREATE TYPE "TransactionCategory" AS ENUM ('SERVICES', 'FOOD', 'HOUSING', 'ENTERTAINMENT', 'GENERAL_TRANSFER', 'YIELD', 'OTHER');

-- AlterTable
ALTER TABLE "transfers" ADD COLUMN "category" "TransactionCategory" NOT NULL DEFAULT 'GENERAL_TRANSFER';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN "category" "TransactionCategory" NOT NULL DEFAULT 'GENERAL_TRANSFER';

-- CreateIndex
CREATE INDEX "transactions_walletId_category_createdAt_idx" ON "transactions"("walletId", "category", "createdAt");
