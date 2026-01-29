-- AlterTable InventoryItem: add itemDefinitionId (optional)
ALTER TABLE "InventoryItem" ADD COLUMN "itemDefinitionId" INTEGER;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "InventoryItem_itemDefinitionId_idx" ON "InventoryItem"("itemDefinitionId");

-- AlterTable ProductIngredient: make inventoryItemId optional, add itemDefinitionId
ALTER TABLE "ProductIngredient" ALTER COLUMN "inventoryItemId" DROP NOT NULL;

ALTER TABLE "ProductIngredient" ADD COLUMN "itemDefinitionId" INTEGER;

-- AddForeignKey
ALTER TABLE "ProductIngredient" ADD CONSTRAINT "ProductIngredient_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (unique: one ingredient per product per definition)
CREATE UNIQUE INDEX "ProductIngredient_productId_itemDefinitionId_key" ON "ProductIngredient"("productId", "itemDefinitionId");

-- CreateIndex
CREATE INDEX "ProductIngredient_itemDefinitionId_idx" ON "ProductIngredient"("itemDefinitionId");
