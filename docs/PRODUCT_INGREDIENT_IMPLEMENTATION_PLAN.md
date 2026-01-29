# Product Ingredient Logic – Implementation Plan

**Goal:** Ensure the Product form and actions let users define **how much** and **what dimensions** of a material (from the Catalog) are needed for a product.

**Status:** Most of the logic is already implemented. This plan confirms the schema, documents current behavior, and lists any remaining tweaks.

---

## 1. Database Schema (ProductIngredient)

### 1.1 Current schema (`prisma/schema.prisma`)

```prisma
model ProductIngredient {
  id               String         @id @default(uuid())
  productId        String
  inventoryItemId  String?        // Legacy
  itemDefinitionId Int?
  quantity         Float          // Required
  width            Float?         // Optional – used for sheet materials (mm)
  height           Float?         // Optional – used for sheet materials (mm)
  product          Product        @relation(...)
  inventoryItem    InventoryItem? @relation(...)
  itemDefinition   ItemDefinition? @relation(...)
  ...
}
```

**Checklist:**

| Requirement              | Status | Notes |
|--------------------------|--------|--------|
| `itemDefinitionId` (relation to Catalog) | ✅ | Present; optional for legacy `inventoryItemId`. |
| `quantity` (required)     | ✅ | `Float` – supports fractional amounts (e.g. 0.5) per BUSINESS_LOGIC. |
| `width` (Float?, optional) | ✅ | Used for sheet materials. |
| `height` (Float?, optional) | ✅ | Used for sheet materials. |

**Note on quantity type:** Requirements mentioned `quantity` as `Int`. The schema uses `Float` to support fractional quantities (e.g. "0.5× Lepidlo"). If you need integer-only quantity, add a migration to change `quantity` to `Int` and update Zod + UI accordingly; otherwise keep `Float`.

**Action:** No schema change required for the described behavior. Optionally document the Int vs Float decision in TECH_CONTEXT or BUSINESS_LOGIC.

---

## 2. UI Updates (Product Form – Ingredients Section)

### 2.1 Material selection

| Requirement | Status | Location |
|-------------|--------|----------|
| Use a **Combobox** to select **ItemDefinition** (Catalog) | ✅ | `src/components/products/recipe-editor.tsx` – `Combobox` with `definitions` (from `getAllItemDefinitions()`). |

**Action:** None. Create Product Dialog already fetches definitions when opened and passes them to `RecipeEditor`.

### 2.2 Dynamic inputs (Width / Height vs Quantity)

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Fetch selected definition’s **category** | ✅ | Definitions include `category`; `selectedDef = definitions.find(d => d.id === ingredient.itemDefinitionId)`. |
| If category is **SHEET_MATERIAL**: show **Width (mm)** and **Height (mm)** | ✅ | `isSheetMaterial = selectedDef?.category === 'SHEET_MATERIAL'`; Width/Height inputs rendered only when `isSheetMaterial`. |
| If category is **COMPONENT** / **OTHER**: hide Width/Height | ✅ | Width/Height block is inside `{isSheetMaterial && (...)}`. |
| Always show **Quantity** | ✅ | Quantity input is always rendered. |

**Action:** None. Optional: when switching to a non–sheet definition, clear `width`/`height` (already done in `updateIngredient` when `field === 'itemDefinitionId'`).

### 2.3 List display (dimensions in table/list)

| Requirement | Status | Location |
|-------------|--------|----------|
| Show dimensions nicely, e.g. `"Bříza 18mm (500 x 500 mm) - 1 ks"` | ✅ | `formatIngredientSummary` in recipe-editor; `formatIngredientLine` on products page. |

- **Recipe editor:** Under each ingredient, summary line: `"Bříza 18mm (500 × 500 mm) – 1 ks"` or `"Bříza 18mm – 1 ks"` when no dimensions.
- **Products page (card list):** Ingredients list uses `formatIngredientLine(name, quantity, width, height)` → same pattern.

**Optional improvement:** If you want the ingredient list inside the form to look more like a **table** (rows with columns: Material | Dimensions | Quantity | Actions), refactor the recipe editor layout from stacked cards to a table (e.g. `Table` from `@/components/ui/table`) and use the same format string in the “Dimensions” or “Summary” column.

**Action:** No mandatory change. Optionally add a table layout in the recipe editor for consistency with “list display” wording.

---

## 3. Server Actions (createProduct / updateProduct)

### 3.1 createProduct

| Requirement | Status | Implementation |
|-------------|--------|----------------|
| Pass and save **quantity** | ✅ | `createProduct` uses `validated.ingredients`; each ingredient has `quantity`; `tx.productIngredient.createMany` writes `quantity: ingredient.quantity`. |
| Pass and save **width**, **height** | ✅ | `width: ingredient.width ?? null`, `height: ingredient.height ?? null` in `createMany` payload. |
| Use **itemDefinitionId** (no legacy inventory item for new recipes) | ✅ | `itemDefinitionId: ingredient.itemDefinitionId`, `inventoryItemId: null`. |

**Action:** None.

### 3.2 updateProduct

There is **no update product** flow in the app yet (no `updateProduct` action, no edit product page/dialog).

**Action (future):** When adding “Edit product”:

1. Add `updateProduct` in `src/app/actions/products.ts` that:
   - Accepts product id + same shape as create (name, description, sellingPrice, productionSteps, photoUrl, ingredients).
   - Updates product fields and **replaces** ingredients: delete existing `ProductIngredient` for that product, then create new ones from the payload (same as create: `itemDefinitionId`, `quantity`, `width`, `height`).
2. Reuse the same ingredient schema and validation (including SHEET_MATERIAL width/height requirement in the dialog).
3. Reuse `RecipeEditor` in an “Edit product” dialog with pre-filled ingredients (same structure: `itemDefinitionId`, `quantity`, `width`, `height`).

---

## 4. Validation (Zod)

**Current:** `src/lib/schemas/products.ts` – `ingredientSchema` has:

- `itemDefinitionId`: positive int, required.
- `quantity`: positive number, required.
- `width` / `height`: positive number, optional.

SHEET_MATERIAL-specific “width/height required” is enforced in the **Create Product Dialog** (client-side) when building `errors` per ingredient.

**Action:** No change required. Optional: if you add server-side conditional validation (e.g. when category is SHEET_MATERIAL), you’d need to pass category in the payload or look it up in the action and use a refined schema; current client-side check is sufficient.

---

## 5. Step-by-step implementation checklist

Use this as a concise checklist; most items are already done.

1. **Schema**
   - [x] Confirm `ProductIngredient` has `itemDefinitionId`, `quantity`, `width?`, `height?`.
   - [ ] Optional: decide Int vs Float for `quantity` and document; add migration only if switching to Int.

2. **Product form – ingredients**
   - [x] Material: Combobox for ItemDefinition (catalog).
   - [x] Dynamic inputs: Width/Height only for SHEET_MATERIAL; Quantity always.
   - [x] Clearing width/height when changing definition (e.g. to COMPONENT).
   - [x] List display: formatted line with name, optional dimensions, quantity (e.g. `"Bříza 18mm (500 × 500 mm) – 1 ks"`).
   - [ ] Optional: show ingredients in a table layout in the recipe editor.

3. **Server actions**
   - [x] createProduct: pass and save `itemDefinitionId`, `quantity`, `width`, `height`.
   - [ ] Future: add updateProduct and edit UI when product editing is required.

4. **Validation**
   - [x] Zod ingredient schema: required itemDefinitionId and quantity; optional width/height.
   - [x] Dialog: require width/height when category is SHEET_MATERIAL.

5. **Products page**
   - [x] Ingredient list uses `formatIngredientLine` so dimensions display correctly (e.g. "Bříza 18mm (500 × 500 mm) – 1 ks").

---

## 6. Summary

- **Database:** ProductIngredient already has the needed fields; no migration required unless you switch quantity to Int.
- **UI:** Recipe editor already uses Catalog (ItemDefinition) combobox, shows Width/Height only for SHEET_MATERIAL, always shows Quantity, and displays a clear summary line; products page uses the same format for the ingredient list.
- **Actions:** createProduct already persists itemDefinitionId, quantity, width, and height correctly. updateProduct does not exist yet; when you add edit product, follow the same ingredient shape and validation.

No code changes are strictly required to meet the stated requirements; only optional refinements (quantity type, table layout in recipe editor, future updateProduct) are listed above.
