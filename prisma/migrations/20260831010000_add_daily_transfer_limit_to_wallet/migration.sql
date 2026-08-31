-- AlterTable
ALTER TABLE "wallets" ADD COLUMN "dailyTransferLimit" DECIMAL(12,2) NOT NULL DEFAULT 100000.00;
