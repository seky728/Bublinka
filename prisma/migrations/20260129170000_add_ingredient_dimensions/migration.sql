-- AlterTable ProductIngredient: add optional width and height (mm, for sheet materials)
ALTER TABLE "ProductIngredient" ADD COLUMN "width" DOUBLE PRECISION;
ALTER TABLE "ProductIngredient" ADD COLUMN "height" DOUBLE PRECISION;
