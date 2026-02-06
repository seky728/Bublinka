-- AlterTable
ALTER TABLE "ItemDefinition" ADD COLUMN     "purchasePrice" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "vatCode" TEXT NOT NULL DEFAULT 'STANDARD';

-- CreateTable
CREATE TABLE "VatRate" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),

    CONSTRAINT "VatRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VatRate_code_validFrom_idx" ON "VatRate"("code", "validFrom");

-- CreateIndex
CREATE UNIQUE INDEX "VatRate_code_validFrom_key" ON "VatRate"("code", "validFrom");
