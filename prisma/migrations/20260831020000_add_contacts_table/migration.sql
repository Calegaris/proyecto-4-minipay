-- CreateTable
CREATE TABLE "contacts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contactUserId" TEXT NOT NULL,
    "aliasCustomName" VARCHAR(50) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contacts_userId_idx" ON "contacts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_userId_contactUserId_key" ON "contacts"("userId", "contactUserId");

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_contactUserId_fkey" FOREIGN KEY ("contactUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
