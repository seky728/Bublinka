# Cut/Allocation Workflow – Implementation Plan

**Goal:** Fix Order Detail spacing and implement the interactive "Cut" flow: Orange Badge (Potřeba řez) → Click "Vyřešit" → Select source board → Cut → Green Badge (Připraveno).

---

## 1. UI Fix – Spacing (Order Detail Page)

**File:** `src/app/orders/[id]/page.tsx`

**Changes:**

1. **Add vertical spacing** between the "Položky objednávky" table and the MaterialCheck section:
   - Wrap the main content sections (Items Table + MaterialCheck) in a container with `className="space-y-8"` (or add `mt-8` to the MaterialCheck wrapper / the block that contains the separator + MaterialCheck).
   - Alternatively: add `mt-8` to the first child that follows the Items Table (the separator or the MaterialCheck container).

2. **Add a visual separator** between Order Items and Material Check:
   - **Option A:** Add the shadcn **Separator** component. The project does not currently have `Separator` in `src/components/ui/`. Add it via `npx shadcn@latest add separator` (or create a minimal one: horizontal line with `role="separator"` and border/margin).
   - **Option B:** Use a simple `<hr />` or a `<div className="border-t my-8" />` between the table and MaterialCheck.
   - **Recommended:** Add the shadcn Separator for consistency; place it between the closing `</div>` of the Items Table and the conditional block that renders MaterialCheck. Apply `className="my-8"` (or equivalent) so spacing is consistent.

**Concrete structure (after Items Table):**

```tsx
      </div>  {/* end Items Table */}

      {/* Spacing + separator before Material Check */}
      {(order.status === 'DRAFT' || order.status === 'IN_PROGRESS') && (
        <>
          <Separator className="my-8" />
          <MaterialCheck orderId={orderId} onResolved={loadOrder} />
        </>
      )}
```

- If the parent of these sections is a single column layout, ensure the parent has `space-y-8` or each section has `mt-8` so the separator and MaterialCheck sit 8 units below the table.

---

## 2. MaterialCheck – "Vyřešit" Button and CutAllocationDialog

**File:** `src/components/orders/material-check.tsx`

**Changes:**

1. **Props:**
   - Keep `orderId: number`.
   - Add optional `onResolved?: () => void` callback. After a successful cut, call `onResolved()` so the parent can refresh the order (and MaterialCheck will refetch when it re-mounts or when we explicitly refetch – see below).

2. **Refetch after resolve:**
   - Either: Parent passes `onResolved` and calls `loadOrder()` (order detail already has this). MaterialCheck can also expose a refetch (e.g. key by timestamp or call a reload function passed as prop). Simplest: after successful cut, call `onResolved()` and inside MaterialCheck refetch material availability (e.g. call `getOrderMaterialAvailability` again and set state) so the list updates and the row turns green without full page reload.
   - Recommended: MaterialCheck maintains a `refreshKey` or internal `refetch()` that is triggered after CutAllocationDialog reports success. So: add `onResolved?: () => void`; when dialog closes with success, call `onResolved()` and in MaterialCheck re-run the same `useEffect` fetch (e.g. by incrementing a dependency or calling a state-setter that triggers refetch). Easiest: pass `onResolved` from page; in MaterialCheck after success call `onResolved()` and then locally refetch material availability (e.g. set a `lastResolvedAt` state and use it in useEffect deps, or call a function that re-fetches and sets `requirements`).

3. **Per-row actions for `cut_needed`:**
   - For each requirement with `status === 'cut_needed'`, render a **Button "Vyřešit"** next to the status badge.
   - Only show the button when the requirement is sheet material (has `width` and `height`); components/other do not use the cut flow.

4. **CutAllocationDialog state:**
   - Local state: `cutDialogOpen: boolean`, `cutDialogRequirement: MaterialRequirement | null`.
   - Clicking "Vyřešit" sets `cutDialogRequirement` to that requirement and opens the dialog.
   - Closing the dialog clears `cutDialogRequirement` and sets `cutDialogOpen` to false.

5. **CutAllocationDialog component (new file):**
   - Location: `src/components/orders/cut-allocation-dialog.tsx`.
   - Rendered by MaterialCheck when `cutDialogRequirement != null`.

**UI flow:** Orange Badge + "Vyřešit" → click → CutAllocationDialog opens with that requirement’s data.

---

## 3. CutAllocationDialog – Component Spec

**File:** `src/components/orders/cut-allocation-dialog.tsx`

**Props:**

- `open: boolean`
- `onOpenChange: (open: boolean) => void`
- `requirement: MaterialRequirement` (must have `width`, `height`, `itemDefinitionId`, `definitionName`, `quantityRequired`)
- `orderId: number`
- `onSuccess: () => void` – called after successful cut so parent can refetch material list (and optionally order).

**Data fetching:**

- On open (when `open && requirement`), call a new server action **`getAvailableSourceBoards(itemDefinitionId, minWidth, minHeight)`** that returns inventory items where:
  - `itemDefinitionId === itemDefinitionId`
  - `status === 'AVAILABLE'`
  - `width >= minWidth` and `height >= minHeight`
  - Optionally exclude already fully reserved: `reservedQuantity < 1` (or keep simple and use `AVAILABLE` only).
- Display as a list (e.g. radio list or table): each row "Deska #105 – 2000×1000 mm" (use item `name` and `width`/`height`). If the backend returns items with an id, show a short label; you can use `id` slice for "Deska #105" or the name if it already contains dimensions.

**User selection:**

- User selects **one** source board (single selection).
- Primary action button: **"Nařezat"**.
- On "Nařezat": call **`performOrderCut`** with `sourceItemId`, `targetWidth`, `targetHeight`, `quantity` (1 per cut for now), `orderId`. On success: toast, call `onSuccess()`, `onOpenChange(false)`.

**Edge cases:**

- No available boards: show message "Žádné dostupné desky větší než požadované rozměry."
- Loading state while fetching boards.
- Disable "Nařezat" until a board is selected.

---

## 4. Server Actions

### 4.1 `getAvailableSourceBoards(itemDefinitionId, minWidth, minHeight)`

**Location:** `src/app/actions/inventory.ts` (or `orders.ts`; inventory is more coherent).

**Input:** Zod schema e.g. `{ itemDefinitionId: number, minWidth: number, minHeight: number }`.

**Logic:**

- Query `InventoryItem` where:
  - `itemDefinitionId === itemDefinitionId`
  - `status === 'AVAILABLE'`
  - `width >= minWidth`
  - `height >= minHeight`
- Order by size or createdAt.
- Return `{ success: true, data: items }` with at least `id`, `name`, `width`, `height`, `thickness`, `price` (for creating the target piece with proportional price).

**Output:** List of items the user can choose as "source board".

---

### 4.2 `performOrderCut(sourceItemId, targetWidth, targetHeight, quantity, orderId)`

**Location:** `src/app/actions/orders.ts` or `src/app/actions/inventory.ts`. Prefer **inventory.ts** so all cut/inventory logic stays in one place; orders.ts can re-export if needed.

**Input (Zod):**

- `sourceItemId: string` (uuid)
- `targetWidth: number` (positive)
- `targetHeight: number` (positive)
- `quantity: number` (positive integer; for now 1)
- `orderId: number` (for audit / future use; reservation today is just `reservedQuantity = 1` on the new item)

**Logic (single transaction):**

1. **Load source item.** Validate: exists, `status === 'AVAILABLE'`, `width >= targetWidth`, `height >= targetHeight`.
2. **Consume source:** Update source item to `status = 'CONSUMED'`.
3. **Cut geometry (same as existing cut logic):**  
   For one cut we produce one target piece (targetWidth × targetHeight) and one or two remnants. Choose direction (e.g. horizontal if `originalWidth - targetWidth >= 0`, else vertical) and compute:
   - **Target piece:** dimensions `targetWidth × targetHeight`, same thickness, same `itemDefinitionId`. Price = (source.price * targetArea) / sourceArea.
   - **Main remnant:** e.g. horizontal → `(source.width - targetWidth) × source.height`; vertical → `source.width × (source.height - targetHeight)`.
   - **Secondary remnant (offcut):** e.g. horizontal and `targetHeight < source.height` → `targetWidth × (source.height - targetHeight)`; vertical and `targetWidth < source.width` → `(source.width - targetWidth) × targetHeight`.
4. **Create target item:**  
   `InventoryItem` with: name (e.g. from ItemDefinition name or "Řez pro zakázku"), targetWidth, targetHeight, source thickness, calculated price, `status: 'AVAILABLE'`, **`reservedQuantity: 1`**, `itemDefinitionId` from source. This is the piece "allocated" to the order.
5. **Create remnant(s):**  
   Same as existing `cutInventoryItem`: main and/or secondary remnant with `status: 'REMNANT'`, `parentId: sourceItemId`, proportional price, `itemDefinitionId` from source, name e.g. "Zbytek z [source.name]".
6. **Transaction:** All of the above in one `prisma.$transaction`.

**Output:** `{ success: true, message: '...' }` or error. No need to return the new item id unless the UI needs it.

**Revalidate:** The dialog calls `onSuccess()`; MaterialCheck refetches `getOrderMaterialAvailability`. The corresponding requirement row can turn **Ready** (green) because there is now an exact-matching item (the one we just created and reserved).

---

## 5. UI Flow Summary (Orange → Green)

1. User is on Order Detail; order status DRAFT or IN_PROGRESS.
2. **Material Check** shows a row: e.g. "Bříza 18mm – 2 ks, 500 × 500 mm" with badge **Potřeba řez** (orange) and button **Vyřešit**.
3. User clicks **Vyřešit** → **CutAllocationDialog** opens with:
   - Title/description: e.g. "Nařezat materiál: Bříza 18mm (2 ks, 500×500 mm)"
   - Fetched list: "Deska #xyz – 2000×1000 mm", …
4. User selects one source board and clicks **Nařezat**.
5. **performOrderCut** runs (consume source, create target + remnants, reserve target).
6. On success: dialog closes, toast "Řez proveden" (or similar), MaterialCheck **refetches** material availability.
7. The same requirement row now shows **Připraveno** (green) because an exact 500×500 mm item exists (the newly created and reserved one). If multiple pieces were needed (e.g. 2 ks), user may need to repeat the cut for the second piece, or the action can be extended later to support quantity > 1 in one go.

---

## 6. Implementation Checklist

| # | Task | File(s) |
|---|------|--------|
| 1 | Add spacing (mt-8 / space-y-8) and Separator between Order Items and MaterialCheck | `src/app/orders/[id]/page.tsx` |
| 2 | Add shadcn Separator component (or minimal equivalent) | `src/components/ui/separator.tsx` |
| 3 | MaterialCheck: add "Vyřešit" button for rows with `status === 'cut_needed'` and sheet dimensions | `src/components/orders/material-check.tsx` |
| 4 | MaterialCheck: state for CutAllocationDialog (open, selected requirement); pass onSuccess and refetch after success | `src/components/orders/material-check.tsx` |
| 5 | Create CutAllocationDialog: props, fetch source boards, list, select one, "Nařezat" → performOrderCut | `src/components/orders/cut-allocation-dialog.tsx` |
| 6 | Server action getAvailableSourceBoards(itemDefinitionId, minWidth, minHeight) | `src/app/actions/inventory.ts` |
| 7 | Server action performOrderCut(sourceItemId, targetWidth, targetHeight, quantity, orderId) | `src/app/actions/inventory.ts` (or orders.ts) |
| 8 | Wire onResolved from Order Detail to MaterialCheck; ensure MaterialCheck refetches after cut success | `src/app/orders/[id]/page.tsx`, `material-check.tsx` |

---

## 7. Optional / Later

- **Quantity > 1:** Allow "Nařezat 2 ks" from one large board (multiple cuts); would require either multiple target items or a single cut that produces multiple same-size pieces (current model is one physical item = one record).
- **Order–item link:** If you add an `orderId` (or reservation table) to track which item is reserved for which order, performOrderCut could set that when creating the target item.
- **Exact match first:** In CutAllocationDialog, sort or highlight boards that are exact match (width/height = required) so the user can prefer them over "need to cut".

This plan focuses on the UI flow **Orange Badge → Click Vyřešit → Select Board → Nařezat → Green Badge** and the minimal server actions and layout fix needed to implement it.
