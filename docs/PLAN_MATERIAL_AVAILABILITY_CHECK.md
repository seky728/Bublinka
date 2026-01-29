# Material Availability Check – Implementation Plan

**Goal:** On the Order Detail page, show whether there is enough material in stock to fulfill the order. Display only when order status is **DRAFT** or **IN_PROGRESS**. No allocation/cut actions in this step—display only.

---

## 1. Data Model Recap

- **Order** → **OrderItem** (productId, quantity) → **Product** → **ProductIngredient** (itemDefinitionId, quantity, width?, height?).
- **ProductIngredient**: For SHEET_MATERIAL we have width/height (mm); for COMPONENT/OTHER only quantity.
- **InventoryItem**: itemDefinitionId, width, height, thickness, status (AVAILABLE/CONSUMED/REMNANT), reservedQuantity.
- **ItemDefinition**: id, name, category (SHEET_MATERIAL | COMPONENT | OTHER).

---

## 2. Calculation Logic

### 2.1 Aggregate requirements by material

**Input:** Order ID.

**Steps:**

1. Load order with `items` and each item’s `product` including `ingredients` with `itemDefinition` (id, name, category).
2. For each **OrderItem** (productId, quantity = Q):
   - For each **ProductIngredient** (itemDefinitionId, quantity, width?, height?):
     - **Required quantity** = `Q * ingredient.quantity` (e.g. 2 order items × 1.5 = 3 pieces).
     - For SHEET_MATERIAL: each “piece” has size (ingredient.width, ingredient.height).
     - For COMPONENT/OTHER: no dimensions.
3. **Group requirements** by a key that identifies “one material demand”:
   - **SHEET_MATERIAL:** key = `(itemDefinitionId, width, height)`. Sum `required quantity` per key.  
     Example: 2× (500×500) + 1× (300×300) → two requirement rows.
   - **COMPONENT/OTHER:** key = `(itemDefinitionId)` only. Sum `required quantity` per key.

**Output (per requirement row):**

- `itemDefinitionId`
- `definitionName` (from ItemDefinition)
- `category` (SHEET_MATERIAL | COMPONENT | OTHER)
- `quantityRequired` (number of pieces/units)
- `width` (mm, only for SHEET_MATERIAL)
- `height` (mm, only for SHEET_MATERIAL)

### 2.2 Check inventory per requirement

For each requirement row:

1. **Query inventory:**  
   `InventoryItem` where `itemDefinitionId = requirement.itemDefinitionId`, `status = 'AVAILABLE'`.  
   For **IN_PROGRESS** orders, optionally consider `reservedQuantity` (e.g. treat “available” as `reservedQuantity < 1` or use same query as reservation logic). For simplicity, use **AVAILABLE** only; reserved items are still “there” for this check.

2. **SHEET_MATERIAL (width and height present):**
   - **Exact match:** inventory items where `width = requirement.width` and `height = requirement.height`. Count = N_exact.
   - **Larger (can cut):** inventory items where `width >= requirement.width` and `height >= requirement.height` and not exact. Count = N_larger.
   - **Status:**
     - **Ready:** `N_exact >= quantityRequired`.
     - **Cut Needed:** `N_exact < quantityRequired` but there is at least one larger item (so we could cut to cover).
     - **Missing:** no inventory, or no item has `width >= req.width` and `height >= req.height`.

3. **COMPONENT/OTHER (no width/height):**
   - Count inventory items with that `itemDefinitionId` and status AVAILABLE = N.
   - **Ready:** `N >= quantityRequired`.
   - **Cut Needed:** N/A (no dimensions).
   - **Missing:** `N < quantityRequired`.

**Output (per requirement row):** Add `status: 'ready' | 'cut_needed' | 'missing'` and optionally:
- `exactCount`, `largerCount` (for UI tooltips).
- `summary` string (e.g. “2 ks 500×500 mm – Ready”).

---

## 3. Server Action

### 3.1 New action: `getOrderMaterialAvailability(orderId: number)`

**Location:** `src/app/actions/orders.ts` (or a dedicated `src/app/actions/order-material-check.ts` if preferred).

**Steps:**

1. Validate `orderId` (e.g. reuse or mirror `getOrderSchema`).
2. Load order with:
   - `items` (orderItem.id, productId, quantity)
   - `product` → `ingredients` with `itemDefinition` (id, name, category).
3. Build requirement list (aggregate by (itemDefinitionId, width?, height?) as above).
4. For each requirement:
   - Query `InventoryItem` where `itemDefinitionId`, `status = 'AVAILABLE'`.
   - For SHEET_MATERIAL: compute exact count and “larger” count; set status (ready / cut_needed / missing).
   - For COMPONENT/OTHER: count items; set ready or missing.
5. Return `{ success: true, data: MaterialRequirement[] }` where each element has at least:
   - `itemDefinitionId`, `definitionName`, `category`, `quantityRequired`, `width?`, `height?`
   - `status: 'ready' | 'cut_needed' | 'missing'`
   - Optional: `exactCount`, `largerCount`, `summary`.

**Edge cases:**

- Order has no items → return empty array.
- Product has no ingredients or only legacy (inventoryItemId, no itemDefinitionId) → skip or mark “unknown” (optional; can skip for v1).
- Missing ItemDefinition (deleted) → still show by id/name if loaded; otherwise skip.

---

## 4. UI Component: `MaterialCheck`

### 4.1 File and placement

- **File:** `src/components/orders/material-check.tsx`.
- **Used in:** `src/app/orders/[id]/page.tsx`, only when `order.status === 'DRAFT' || order.status === 'IN_PROGRESS'`.

### 4.2 Props

- `orderId: number` — to call `getOrderMaterialAvailability(orderId)`.
- Optional: `status: OrderStatus` to hide when COMPLETED/CANCELLED (or derive from order in parent).

### 4.3 Behavior

1. On mount (and when `orderId` changes), call `getOrderMaterialAvailability(orderId)`.
2. Show loading state while fetching.
3. If order has no items or no requirements, show a short message (e.g. “Žádné materiálové požadavky” / “Přidejte položky do objednávky”).
4. Otherwise render a **list of required materials** with:
   - Material name (definition name).
   - Required quantity and dimensions (e.g. “2 ks, 500 × 500 mm” for sheets; “3 ks” for components).
   - **Status badge:**
     - **Ready:** green (e.g. “Připraveno” / “Ready”).  
       Visual: green badge (e.g. 🟢 or `bg-green-100 text-green-800`).
     - **Cut Needed:** orange (e.g. “Potřeba řez” / “Cut Needed”).  
       Visual: orange badge (🟠 or `bg-orange-100 text-orange-800`).
     - **Missing:** red (e.g. “Chybí” / “Missing”).  
       Visual: red badge (🔴 or `bg-red-100 text-red-800`).
5. No buttons or actions in this step; display only.

### 4.4 Section title

Use a clear heading, e.g. **“Kontrola dostupnosti materiálu”** (Material availability check).

---

## 5. Order Detail Page Integration

**File:** `src/app/orders/[id]/page.tsx`.

- After the “Položky objednávky” table (or after status banners), add a conditional block:

  - **Condition:** `order.status === 'DRAFT' || order.status === 'IN_PROGRESS'`.
  - **Content:** `<MaterialCheck orderId={orderId} />`.

- Optionally pass `order.status` to `MaterialCheck` so the component can hide itself when status changes (e.g. after “Dokončit”) without relying only on parent conditional.

---

## 6. Types

**Suggested (e.g. in component file or `src/lib/types/order-material.ts`):**

```ts
export type MaterialAvailabilityStatus = 'ready' | 'cut_needed' | 'missing';

export interface MaterialRequirement {
  itemDefinitionId: number;
  definitionName: string;
  category: 'SHEET_MATERIAL' | 'COMPONENT' | 'OTHER';
  quantityRequired: number;
  width?: number;
  height?: number;
  status: MaterialAvailabilityStatus;
  exactCount?: number;   // optional, for tooltips
  largerCount?: number;  // optional, for tooltips
}
```

Use these (or equivalent) in the server action return type and in the component.

---

## 7. Implementation Checklist

| Step | Task | Notes |
|------|------|--------|
| 1 | Add server action `getOrderMaterialAvailability(orderId)` | Load order with items + product.ingredients + itemDefinition; aggregate requirements; query inventory; compute status per requirement. |
| 2 | Define types `MaterialRequirement`, `MaterialAvailabilityStatus` | In component file or shared types. |
| 3 | Create `src/components/orders/material-check.tsx` | Fetch data by orderId; show loading; list materials with status badges (Ready / Cut Needed / Missing); Czech labels. |
| 4 | Integrate in Order Detail page | Render `<MaterialCheck orderId={orderId} />` only when status is DRAFT or IN_PROGRESS. |
| 5 | Manual test | Create order, add products with sheet and component ingredients; add inventory; verify Ready / Cut Needed / Missing. |

---

## 8. Optional Enhancements (later)

- Consider **reservedQuantity** for IN_PROGRESS (e.g. exclude reserved items from “available” count, or show “already reserved for this order”).
- Tooltips on badges with exact/larger counts.
- Empty state when order has no items: “Přidejte položky do objednávky pro kontrolu materiálu.”
- Legacy ingredients (only inventoryItemId): show as “Unknown” or skip.

---

## 9. Summary

- **Calculation:** Order → OrderItems → Product → ProductIngredients; group by (itemDefinitionId, width?, height?); sum quantity. For each group, query AVAILABLE inventory; for sheets compare dimensions (exact vs larger); set ready / cut_needed / missing.
- **Server:** New action `getOrderMaterialAvailability(orderId)` returning `MaterialRequirement[]`.
- **UI:** New component `MaterialCheck` in `src/components/orders/material-check.tsx`, shown on Order Detail only for DRAFT/IN_PROGRESS, listing materials with green/orange/red status badges; no actions yet.
