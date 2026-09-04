-- AlterTable
ALTER TABLE "wallets" ADD COLUMN "alias" TEXT NOT NULL,
ADD COLUMN "cvu" VARCHAR(22) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "wallets_alias_key" ON "wallets"("alias");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_cvu_key" ON "wallets"("cvu");

-- CreateIndex
CREATE INDEX "wallets_alias_idx" ON "wallets"("alias");

-- CreateIndex
CREATE INDEX "wallets_cvu_idx" ON "wallets"("cvu");
