-- CreateEnum
CREATE TYPE "ItemDefinitionCategory" AS ENUM ('SHEET_MATERIAL', 'COMPONENT', 'OTHER');

-- CreateTable
CREATE TABLE "ItemDefinition" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ItemDefinitionCategory" NOT NULL,
    "properties" JSONB,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ItemDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ItemDefinition_name_key" ON "ItemDefinition"("name");

-- CreateIndex
CREATE INDEX "ItemDefinition_category_idx" ON "ItemDefinition"("category");

-- CreateIndex
CREATE INDEX "ItemDefinition_createdAt_idx" ON "ItemDefinition"("createdAt");
