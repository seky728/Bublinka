# Technical Context - Bublinka ERP

## Stack Summary

### Core Technologies
- **Next.js 14** - App Router architecture
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS 4** - Styling
- **shadcn/ui** - Component library (New York style)
- **Prisma 7.3.0** - ORM with PostgreSQL Driver Adapter
- **Supabase** - PostgreSQL database (hosted)
- **Zod** - Schema validation
- **React Hook Form** - Form management

### Recent Features (2024)
- **Czech VAT System**: Temporal VAT rate management with semantic codes (STANDARD, REDUCED, ZERO)
- **Product Templates**: Products are now templates/recipes with recommended prices; cost calculations moved to Order view
- **Purchase Price Tracking**: ItemDefinitions can store purchase prices for future cost calculations

### Key Dependencies
- `@prisma/adapter-pg` - PostgreSQL adapter for Prisma
- `pg` - PostgreSQL client library
- `@radix-ui/*` - UI primitives (Dialog, Toast, Checkbox, Radio, Tooltip, etc.)
- `lucide-react` - Icon library
- `class-variance-authority` - Component variants
- `tailwind-merge` - Tailwind class merging utility

## Project Structure

All code is organized under the `src/` directory:

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server actions
│   │   ├── inventory.ts   # Inventory CRUD and cut operations
│   │   ├── item-definitions.ts  # Catalog (ItemDefinition) CRUD
│   │   ├── orders.ts      # Orders CRUD and status/reservation logic
│   │   └── products.ts    # Products CRUD operations
│   ├── catalog/           # Catalog module (item definitions)
│   │   └── page.tsx       # Katalog položek – list and manage ItemDefinitions
│   ├── inventory/         # Inventory page route
│   │   └── page.tsx       # Main inventory dashboard (grouped by definition + dimensions)
│   ├── orders/            # Orders module
│   │   ├── page.tsx       # Orders list
│   │   └── [id]/
│   │       └── page.tsx   # Order detail/edit with status workflow
│   ├── products/          # Products page route
│   │   └── page.tsx       # Products list page
│   ├── layout.tsx         # Root layout with Toaster
│   ├── page.tsx           # Homepage (Dashboard)
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── layout/            # Layout components
│   │   └── Sidebar.tsx    # Collapsible sidebar navigation
│   ├── inventory/         # Inventory-specific components
│   │   ├── add-item-dialog.tsx   # Add item with ItemDefinition combobox + note
│   │   └── cut-item-dialog.tsx
│   ├── orders/            # Orders-specific components
│   │   ├── create-order-dialog.tsx
│   │   ├── order-status-badge.tsx
│   │   ├── material-check.tsx    # Material availability (ready/cut needed/missing) + Vyřešit → CutAllocationDialog
│   │   └── cut-allocation-dialog.tsx  # Select source board, Nařezat → performOrderCut
│   ├── products/          # Products-specific components
│   │   ├── create-product-dialog.tsx
│   │   ├── edit-product-dialog.tsx
│   │   └── recipe-editor.tsx    # Ingredients: ItemDefinition + quantity + width/height (sheet)
│   ├── settings/          # Settings/catalog shared UI
│   │   └── definition-dialog.tsx  # Create/edit ItemDefinition (used by catalog page)
│   └── ui/                # shadcn/ui components
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── separator.tsx
│       ├── table.tsx
│       ├── input.tsx
│       ├── combobox.tsx
│       ├── textarea.tsx
│       ├── tooltip.tsx
│       └── ... (other UI components)
├── hooks/                 # Custom React hooks
│   └── use-toast.ts       # Toast notification hook
└── lib/                   # Utilities and configurations
    ├── prisma.ts          # Prisma client singleton (with PG adapter)
    ├── supabase.ts        # Supabase client for storage operations
    ├── schemas/           # Zod validation schemas
    │   ├── item-definitions.ts  # ItemDefinition CRUD validation
    │   ├── orders.ts      # Order validation schemas
    │   └── products.ts    # Product validation schemas
    ├── types/             # Shared TypeScript types
    │   └── order-material.ts  # MaterialRequirement, MaterialAvailabilityStatus (for material check)
    └── utils.ts           # Utility functions (cn helper)
```

### Path Aliases
Configured in `tsconfig.json`:
- `@/*` → `./src/*`

## Navigation & Layout

### Sidebar Navigation

**Location**: `src/components/layout/Sidebar.tsx`

The application features a permanent desktop sidebar navigation component with the following features:

**Features:**
- **Collapsible Design**: Sidebar can be toggled between expanded (`w-64`) and collapsed (`w-[70px]`) states
- **Smooth Transitions**: All state changes use `transition-all duration-300` for smooth animations
- **Active Route Detection**: Uses `usePathname()` from Next.js to highlight the current page
- **Icon-Only Mode**: When collapsed, navigation items show only icons with tooltips on hover
- **Branding Header**: "Bublinka ERP" header with link to homepage, icon remains visible when collapsed
- **Toggle Button**: Circular floating button positioned on the right border edge, vertically centered

**Navigation Items:**
- "Sklad" (Inventory) → `/inventory` (Package icon)
- "Produkty" (Products) → `/products` (Layers icon)
- "Objednávky" (Orders) → `/orders` (FileText icon)
- "Katalog" (Catalog) → `/catalog` (BookOpen icon)

**Layout Structure:**
- Root layout (`src/app/layout.tsx`) uses flexbox: `flex h-screen overflow-hidden`
- Sidebar is fixed-width on the left
- Main content area uses `flex-1 overflow-y-auto` for scrollable content
- Only the main content scrolls; sidebar remains fixed

**UI Components Used:**
- shadcn/ui Button component with `variant="ghost"`
- shadcn/ui Tooltip component (from `@radix-ui/react-tooltip`) for collapsed state labels
- Lucide React icons (Package, Layers, FileText, BookOpen, ChevronLeft, ChevronRight)

## Database

### Prisma Configuration
- **Provider**: PostgreSQL
- **Adapter**: `@prisma/adapter-pg` (modern driver adapter pattern)
- **Connection**: Via `DATABASE_URL` environment variable (Supabase)
- **Client Location**: `node_modules/@prisma/client`

### ItemDefinition and Catalog

```prisma
enum ItemDefinitionCategory {
  SHEET_MATERIAL
  COMPONENT
  OTHER
}

model ItemDefinition {
  id                 Int                 @id @default(autoincrement())
  name               String              @unique
  category           ItemDefinitionCategory
  properties         Json?
  description        String?
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  inventoryItems     InventoryItem[]
  productIngredients ProductIngredient[]
}
```

**Purpose:**
ItemDefinition is the central catalog of material types (e.g. "Bříza 18mm", "Stainless Steel Flask"). Inventory items and product recipes reference definitions instead of free text or specific physical items. Categories: SHEET_MATERIAL (Deskový materiál), COMPONENT (Komponent), OTHER (Ostatní). The Catalog module (`/catalog`) provides CRUD for definitions; `getAllItemDefinitions()` is used by Add Item Dialog and Recipe Editor.

### InventoryItem Model

```prisma
model InventoryItem {
  id               String           @id @default(uuid())
  name             String           // Display name (from definition + note or legacy free text)
  width            Float            // mm
  height           Float            // mm
  thickness        Float            // mm
  price            Float            // unit price in CZK
  status           InventoryStatus  @default(AVAILABLE)
  reservedQuantity Float            @default(0)  // Reserved for orders (0 or 1 per item)
  itemDefinitionId Int?
  itemDefinition   ItemDefinition?  @relation(...)
  parentId         String?
  parent           InventoryItem?   @relation("InventoryItemRemnants")
  remnants         InventoryItem[]  @relation("InventoryItemRemnants")
  ingredients      ProductIngredient[]
  createdAt        DateTime         @default(now())
  updatedAt        DateTime         @updatedAt
}
```

**Status Enum:**
- `AVAILABLE` - Item is available for use/cutting
- `CONSUMED` - Item has been fully used
- `REMNANT` - Item is a leftover piece from cutting

**Purpose:**
InventoryItem represents physical stock with dimensions and pricing. When created via Add Item Dialog, the user selects an ItemDefinition and optional note; `name` is derived (e.g. definition name + " – " + note). Optional `itemDefinitionId` links the item to the catalog; remnants inherit `itemDefinitionId` from the original. Order reservation matches by `itemDefinitionId` (or by name for legacy items).

### Order and OrderItem Models

```prisma
enum OrderStatus {
  DRAFT
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model Order {
  id        Int         @id @default(autoincrement())
  name      String
  status    OrderStatus @default(DRAFT)
  items     OrderItem[]
  createdAt DateTime    @default(now())
  updatedAt DateTime    @updatedAt

  @@index([status])
  @@index([createdAt])
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  orderId   Int
  productId String
  quantity  Int
  unitPrice Float   // Snapshot of product price at order creation
  order     Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  product   Product @relation(fields: [productId], references: [id])

  @@unique([orderId, productId])
  @@index([orderId])
  @@index([productId])
}
```

**Purpose:**
Orders group Products into jobs. Order ID is displayed as short ID (e.g. #0001). OrderItem links Order to Product with quantity and a price snapshot. Status workflow (DRAFT → IN_PROGRESS → COMPLETED, with revert/cancel options) controls editing lock and inventory reservations.

### Product Model

```prisma
model Product {
  id             String              @id @default(uuid())
  name           String
  description    String?
  photoUrl       String?             // File path in Supabase Storage (not a URL)
  sellingPrice   Float                // Recommended price (displayed as "Doporučená cena" in UI)
  productionSteps String?
  vatCode        String               @default("STANDARD") // VAT rate code (STANDARD, REDUCED, ZERO)
  ingredients    ProductIngredient[]
  orderItems     OrderItem[]
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([name])
  @@index([createdAt])
}
```

**Purpose:**
The Product model represents **templates/recipes** for finished goods. Products are not final sales - they define what materials are needed and provide a recommended price. Recipes reference **ItemDefinitions** (catalog) rather than specific inventory items. The `photoUrl` field stores the file path (not a full URL) in Supabase Storage. Cost calculations are performed in the Order view when specific stock items are selected.

### ProductIngredient Model (Recipe / BOM)

```prisma
model ProductIngredient {
  id               String         @id @default(uuid())
  productId        String
  inventoryItemId  String?        // Legacy; new recipes use itemDefinitionId
  itemDefinitionId Int?
  quantity         Float          // Quantity needed (e.g. 4.0 for "4× Table Leg")
  width            Float?         // mm – used for sheet materials (required when category SHEET_MATERIAL)
  height           Float?         // mm – used for sheet materials
  product         Product        @relation(...)
  inventoryItem   InventoryItem? @relation(...)
  itemDefinition  ItemDefinition? @relation(...)

  @@unique([productId, inventoryItemId])
  @@unique([productId, itemDefinitionId])
  @@index([productId])
  @@index([inventoryItemId])
  @@index([itemDefinitionId])
}
```

**Purpose:**
ProductIngredient is the Bill of Materials (BOM) for a product. New recipes use `itemDefinitionId` (catalog); `inventoryItemId` is optional for legacy data. `quantity` is always required. For sheet materials (definition category SHEET_MATERIAL), `width` and `height` (mm) are stored so the recipe specifies e.g. "500×500 mm – 1 ks". Order reservation uses `itemDefinitionId` and quantity to match and reserve inventory.

## Storage

### Supabase Storage Configuration

- **Bucket**: `products` (Private)
- **Access**: Images are stored in a private bucket and served via **Signed URLs**
- **Security**: Prevents unauthorized access and scraping of product images

### Image Upload Flow

1. **Upload**: When a product image is uploaded via `uploadProductImage()`:
   - File is validated (type, size)
   - Uploaded to Supabase Storage bucket `products`
   - Only the **file path** (e.g., `1234567890-abc123.jpg`) is returned and stored in the database

2. **Storage**: The `photoUrl` field in the Product model stores the file path, not a full URL

3. **Retrieval**: When products are fetched via `getProducts()`:
   - For each product with a `photoUrl` (path), a **Signed URL** is generated server-side
   - Signed URLs are valid for **1 hour** (3600 seconds)
   - The temporary signed URL replaces the path in the response
   - Frontend receives a valid URL that expires after 1 hour

### Supabase Client Configuration

- **Location**: `src/lib/supabase.ts`
- **Key**: Uses `SUPABASE_SERVICE_ROLE_KEY` (required for private bucket operations)
- **Purpose**: Server-side client with permissions to generate signed URLs for private storage

## Current Status

### ✅ Fully Implemented Features

1. **Add Material** (`addInventoryItem`)
   - Single item creation: select **ItemDefinition** (catalog) via combobox, optional note; name derived from definition + note
   - Dimensions (width, height, thickness), price, and optional bulk quantity
   - Form validation using Zod
   - Server action with error handling

2. **Bulk Add** (`addInventoryItem` with quantity)
   - Create multiple identical items in one operation
   - Automatic unit price calculation: `unitPrice = totalPrice / quantity`
   - Transaction-based creation for data integrity

3. **Cut Material** (`cutInventoryItem`)
   - Guillotine-style cutting (horizontal or vertical)
   - Smart remnant calculation (main + secondary)
   - Real-time dimension and price preview in UI
   - Direction selection (horizontal/vertical)

3b. **Order Cut / Allocation** (`performOrderCut`, `getAvailableSourceBoards`) — **Location**: `src/app/actions/inventory.ts`
   - **getAvailableSourceBoards(itemDefinitionId, minWidth, minHeight)**: Returns AVAILABLE inventory items matching definition with dimensions ≥ required. Used by CutAllocationDialog to list source boards.
   - **performOrderCut(sourceItemId, targetWidth, targetHeight, quantity, orderId)**: Guillotine L-shape split in a single transaction: (1) mark source CONSUMED; (2) create **target** item (exact required dimensions, **reservedQuantity: 1**, status AVAILABLE, parentId, itemDefinitionId, name `"[Name] (Cut)"`); (3) create 1 or 2 **offcuts** (Right: `(w_source − w_req) × h_source`, Top: `w_req × (h_source − h_req)`; only if both dimensions > 10 mm). Offcuts have **reservedQuantity: 0** and status AVAILABLE (released to inventory). All new items inherit **itemDefinitionId**, **thickness**, **parentId** from source. After success, **revalidatePath** `/orders/[id]` and `/inventory`. Used from Order Detail when user resolves "Potřeba řez" via Vyřešit → select board → Nařezat.

4. **Consume Whole** (special cut case)
   - Quick action to consume entire item
   - Detects when cut dimensions match original
   - No remnants created, item marked as CONSUMED

5. **Smart Remnant Naming**
   - Automatic "Zbytek z [OriginalName]" prefix
   - Prevents recursive naming (Zbytek z Zbytek z...)
   - Maintains traceability to parent item

6. **Inventory Dashboard** (`/inventory`)
   - Table view grouped by **itemDefinitionId + width + height + thickness** (strict dimension separation; different dimensions = separate rows)
   - Columns: Název, Rozměry, Cena, **Celkem** (total physical quantity, "X ks"), **Rezervováno**, **Dostupné** (total − reserved)
   - **Status badge** derived from group totals (not only DB status): CONSUMED → "Spotřebováno" (gray); if AVAILABLE: available ≤ 0 and quantity > 0 → "Rezervováno" (amber); available > 0 and reserved > 0 → "Částečně rezervováno" (blue); reserved === 0 → "Dostupné" (green)
   - Action buttons per row (Řezat uses first available item in that dimension group)

7. **UI Components**
   - Add Item Dialog with bulk support
   - Cut Item Dialog with real-time calculations
   - Toast notifications (Czech language)
   - Responsive table layout

8. **Catalog Module** (`/catalog`)
   - "Katalog položek" page: list and manage **ItemDefinition** records (data table, add/edit/delete)
   - Definition dialog: name, category (SHEET_MATERIAL / COMPONENT / OTHER), description, properties (JSON)
   - Used by Inventory (Add Item combobox) and Products (Recipe Editor ingredient selection)

9. **Products Module** (`/products`)
   - Product list page with grid view; **Edit** and Delete per product
   - Create Product Dialog and **Edit Product Dialog** with form validation; Recipe Editor uses **ItemDefinition** for ingredients (quantity; width/height required for SHEET_MATERIAL), table layout for ingredient list
   - **Recommended Price** field (displayed as "Doporučená cena" in UI) - this is a template value, not a final sale price
   - **VAT Rate Selection** - Combobox to select STANDARD (21%), REDUCED (12%), or ZERO (0%) VAT rate
   - Image upload with preview; getProduct returns imageUrl (signed) for edit preview, photoUrl (path) for save
   - Product creation, update (**updateProduct**), and deletion with cascade cleanup
   - **Note**: Cost/margin calculations are NOT shown in Product dialogs - products are templates. Actual costs are calculated in Order view when specific stock items are selected

10. **Orders Module** (`/orders`)
   - Orders list: table with ID (#0000), Name, Status, Date, Total Items; create order; row click → detail
   - Order detail (`/orders/[id]`): editable name (when DRAFT), status badge, items table, add product (Combobox + quantity), remove item
   - **Order Status Workflow**: DRAFT ↔ IN_PROGRESS ↔ COMPLETED, any → CANCELLED; CANCELLED → DRAFT ("Obnovit zakázku"); COMPLETED → IN_PROGRESS ("Vrátit do výroby")
   - **Soft lock**: When status is not DRAFT, add product form and item delete are hidden, name editing disabled; banner explains revert to edit
   - Status-specific banners: CANCELLED ("Zakázka je zrušena" + Obnovit), COMPLETED ("Zakázka je hotová" + Vrátit do výroby), IN_PROGRESS (info banner)
   - Create order redirects to new order detail page after success
   - **Material Availability Check** (when status DRAFT or IN_PROGRESS): **MaterialCheck** component below Order Items table (with Separator and spacing). Shows required materials with status badges: 🟢 Připraveno (exact or enough stock), 🟠 Potřeba řez (only larger boards available), 🔴 Chybí. For "Potřeba řez" a **Vyřešit** button opens **CutAllocationDialog**: user selects a source board from available inventory (matching definition, dimensions ≥ required), clicks **Nařezat**; **performOrderCut** consumes source, creates target piece (exact dimensions, reservedQuantity 1), creates remnants; MaterialCheck refetches and row can turn green (Připraveno).

11. **Inventory Reservations**
   - On order DRAFT → IN_PROGRESS: total required ingredients (from product BOM × order item quantity) are computed; matching AVAILABLE items by **itemDefinitionId** (or by name for legacy) get `reservedQuantity` set (reservation)
   - On IN_PROGRESS → COMPLETED: reserved items are released and marked CONSUMED
   - On IN_PROGRESS → DRAFT or CANCELLED: reservedQuantity is released (no consumption)
   - On COMPLETED → IN_PROGRESS (reopen): inventory is reserved again
   - CANCELLED → DRAFT: no inventory change (already released)

12. **Sidebar Navigation** (`/components/layout/Sidebar.tsx`)
   - Permanent desktop sidebar with collapsible functionality
   - Active route highlighting using `usePathname()` (including `/orders/[id]`)
   - Icon-only mode with tooltips when collapsed
   - Smooth transitions and animations
   - Circular toggle button on right border edge
   - Nav items: Sklad, Produkty, Objednávky, Katalog

### Products Server Actions

**Location**: `src/app/actions/products.ts`

1. **`getProducts()`**
   - Fetches all products with their ingredients
   - Generates signed URLs for product images (valid for 1 hour)
   - Returns products with temporary signed URLs for frontend display

2. **`createProduct(data)`**
   - Creates product with basic information
   - Creates ProductIngredient records in a transaction (itemDefinitionId, quantity, optional width/height for sheet materials)
   - Accepts file path (from upload) for `photoUrl`
   - Returns created product with ingredients

3. **`deleteProduct(id)`**
   - Deletes product and all related ingredients (cascade)
   - Removes associated image from Supabase Storage
   - Transaction-based for data integrity

4. **`uploadProductImage(formData)`**
   - Validates file type and size (max 5MB)
   - Uploads to Supabase Storage bucket `products`
   - Returns file path (not a URL) for database storage
   - Supported formats: JPG, PNG, WEBP, GIF

5. **`getProduct(id)`**
   - Returns single product with ingredients and itemDefinition; adds **imageUrl** (signed URL) for display, keeps **photoUrl** (path) for form submit. Used by Edit Product Dialog.

6. **`updateProduct(data)`**
   - Updates product fields and replaces ingredients (delete existing, create from payload). Same ingredient shape as create (itemDefinitionId, quantity, width, height).

### Orders Server Actions

**Location**: `src/app/actions/orders.ts`

1. **`getOrders()`**
   - Returns all orders with item counts and formatted ID (#0000)

2. **`getOrder(id)`**
   - Returns single order with items and product details (id, name, sellingPrice, photoUrl)

3. **`getOrderMaterialAvailability(orderId)`**
   - Loads order with items and product ingredients (itemDefinition, width, height). Aggregates requirements by (itemDefinitionId, width?, height?), sums quantity per group. For each requirement, queries AVAILABLE inventory: for SHEET_MATERIAL (with dimensions) counts exact-match and larger items, sets status **ready** / **cut_needed** / **missing**; for COMPONENT/OTHER counts items and sets ready or missing. Returns `MaterialRequirement[]` (definitionName, quantityRequired, width?, height?, status). Used by **MaterialCheck** on Order Detail.

4. **`createOrder(data)`**
   - Creates order (name, status default DRAFT); returns created order and **orderId** for redirect to `/orders/[id]`

5. **`updateOrder(data)`**
   - Updates order name and/or status (partial updates supported)

6. **`updateOrderStatus(id, newStatus)`**
   - Validates status transitions (DRAFT→IN_PROGRESS, IN_PROGRESS→COMPLETED/DRAFT/CANCELLED, COMPLETED→CANCELLED/IN_PROGRESS, CANCELLED→DRAFT)
   - **Inventory reservation logic**: On DRAFT→IN_PROGRESS reserves inventory by **itemDefinitionId** (from BOM × order item qty; fallback to name for legacy); on IN_PROGRESS→COMPLETED consumes reserved items; on revert/cancel releases reservations; on COMPLETED→IN_PROGRESS re-reserves

7. **`deleteOrder(id)`**
   - Deletes order (cascade deletes OrderItems)

8. **`addOrderItem(orderId, productId, quantity)`**
   - Adds product to order with current sellingPrice snapshot; prevents duplicate product per order

9. **`removeOrderItem(itemId)`**
   - Removes one order item by id

**Validation**: `src/lib/schemas/orders.ts` (createOrder, updateOrder, deleteOrder, addOrderItem, removeOrderItem, getOrder, updateOrderStatus)

## E2E Testing

### Playwright Configuration

**Location**: `playwright.config.ts`

The project uses **Playwright** for end-to-end testing. All interactive elements across the application have been annotated with `data-testid` attributes to enable reliable test selectors.

### Test ID Naming Convention

All `data-testid` attributes follow a strict naming convention: `[context]-[element-role]` in kebab-case.

**Examples:**
- `inventory-submit-btn` - Submit button in inventory context
- `catalog-definition-row` - Table row for a catalog definition
- `order-status-badge-draft` - Status badge for DRAFT status
- `product-name-input` - Name input in product form

### Components with Test IDs

#### Inventory Components
- **Add Item Dialog** (`src/components/inventory/add-item-dialog.tsx`):
  - `inventory-item-definition-select` - ItemDefinition combobox
  - `inventory-note-input` - Note input field
  - `inventory-width-input`, `inventory-height-input`, `inventory-thickness-input` - Dimension inputs
  - `inventory-quantity-input` - Quantity input
  - `inventory-total-price-input` - Total price input
  - `inventory-cancel-btn`, `inventory-submit-btn` - Dialog buttons

- **Cut Item Dialog** (`src/components/inventory/cut-item-dialog.tsx`):
  - `cut-width-input`, `cut-height-input` - Cut dimension inputs
  - `cut-direction-radio` - Direction radio group
  - `cut-direction-horizontal`, `cut-direction-vertical` - Direction options
  - `cut-consume-whole-btn` - Consume whole button
  - `cut-save-main-remnant-checkbox`, `cut-save-secondary-remnant-checkbox` - Remnant checkboxes
  - `cut-cancel-btn`, `cut-submit-btn` - Dialog buttons

#### Orders Components
- **Create Order Dialog** (`src/components/orders/create-order-dialog.tsx`):
  - `order-name-input` - Order name input
  - `order-cancel-btn`, `order-submit-btn` - Dialog buttons

- **Order Status Badge** (`src/components/orders/order-status-badge.tsx`):
  - `order-status-badge-[status]` - Dynamic badge (e.g., `order-status-badge-draft`, `order-status-badge-in_progress`)

- **Material Check** (`src/components/orders/material-check.tsx`):
  - `material-requirement-row` - Each material requirement list item
  - `material-status-badge-[status]` - Status badges (ready, cut_needed, missing)
  - `material-resolve-btn` - "Vyřešit" button for cut-needed items

- **Cut Allocation Dialog** (`src/components/orders/cut-allocation-dialog.tsx`):
  - `cut-allocation-board-option` - Source board selection buttons
  - `cut-allocation-cancel-btn`, `cut-allocation-submit-btn` - Dialog buttons

#### Products Components
- **Create Product Dialog** (`src/components/products/create-product-dialog.tsx`):
  - `product-name-input`, `product-description-input`, `product-selling-price-input`, `product-production-steps-input` - Form inputs
  - `product-image-input` - File upload input
  - `product-cancel-btn`, `product-submit-btn` - Dialog buttons

- **Edit Product Dialog** (`src/components/products/edit-product-dialog.tsx`):
  - `product-edit-name-input`, `product-edit-description-input`, `product-edit-selling-price-input`, `product-edit-production-steps-input` - Form inputs
  - `product-edit-image-input` - File upload input
  - `product-edit-cancel-btn`, `product-edit-submit-btn` - Dialog buttons

- **Recipe Editor** (`src/components/products/recipe-editor.tsx`):
  - `recipe-add-ingredient-btn` - Add ingredient button
  - `recipe-ingredient-row` - Each ingredient table row
  - `recipe-ingredient-definition-[index]` - ItemDefinition combobox per ingredient
  - `recipe-ingredient-width-[index]`, `recipe-ingredient-height-[index]`, `recipe-ingredient-quantity-[index]` - Ingredient inputs
  - `recipe-remove-ingredient-[index]` - Remove ingredient button

#### Settings Components
- **Definition Dialog** (`src/components/settings/definition-dialog.tsx`):
  - `definition-name-input`, `definition-description-input`, `definition-properties-input` - Form inputs
  - `definition-category-radio` - Category radio group
  - `definition-category-[category]` - Category options (e.g., `definition-category-sheet_material`)
  - `definition-cancel-btn`, `definition-submit-btn` - Dialog buttons

#### Layout Components
- **Sidebar** (`src/components/layout/Sidebar.tsx`):
  - `sidebar-nav-[route]` - Navigation buttons (e.g., `sidebar-nav-inventory`, `sidebar-nav-products`)
  - `sidebar-toggle-btn` - Collapse/expand toggle button

#### Pages
- **Catalog Page** (`src/app/catalog/page.tsx`):
  - `catalog-add-btn`, `catalog-add-first-btn` - Add definition buttons
  - `catalog-definition-row` - Definition table rows
  - `catalog-edit-btn`, `catalog-delete-btn` - Action buttons

- **Inventory Page** (`src/app/inventory/page.tsx`):
  - `inventory-add-btn` - Add material button
  - `inventory-row` - Inventory table rows
  - `inventory-status-badge` - Status badges
  - `inventory-cut-btn` - Cut button per row

- **Products Page** (`src/app/products/page.tsx`):
  - `products-add-btn`, `products-add-first-btn` - Add product buttons
  - `products-edit-btn`, `products-delete-btn` - Action buttons

- **Orders Page** (`src/app/orders/page.tsx`):
  - `orders-create-btn`, `orders-create-first-btn` - Create order buttons
  - `order-row` - Order table rows
  - `orders-delete-btn` - Delete button

- **Order Detail Page** (`src/app/orders/[id]/page.tsx`):
  - `order-back-btn` - Back to orders list button
  - `order-name-input` - Editable order name input
  - `order-status-[status]-btn` - Status action buttons (e.g., `order-status-draft-btn`)
  - `order-delete-btn` - Delete order button
  - `order-product-select` - Product combobox
  - `order-quantity-input` - Quantity input
  - `order-add-item-btn` - Add item button
  - `order-item-row` - Order item table rows
  - `order-remove-item-btn` - Remove item button
  - `order-restore-draft-btn`, `order-return-progress-btn` - Status banner buttons

- **Home Page** (`src/app/page.tsx`):
  - `home-inventory-btn`, `home-products-btn` - Navigation buttons

### UI Component Updates

The **Combobox** component (`src/components/ui/combobox.tsx`) has been updated to accept and pass through the `data-testid` prop to its trigger button, enabling test selection of combobox elements.

### Testing Best Practices

1. **Use data-testid for all interactive elements**: Buttons, inputs, selects, checkboxes, radio buttons, table rows, and status badges
2. **Follow naming convention**: Always use `[context]-[element-role]` format
3. **Keep IDs descriptive but concise**: Balance clarity with brevity
4. **Use dynamic IDs for lists**: When elements appear in lists, include index or identifier (e.g., `recipe-ingredient-width-0`)
5. **Status-specific IDs**: Use dynamic values for status badges (e.g., `order-status-badge-${status.toLowerCase()}`)

### 🔧 Technical Implementation Details

- **Server Actions**: All database operations use Next.js server actions
- **Transactions**: Bulk operations, cuts, and product creation use Prisma transactions
- **Validation**: Zod schemas for type-safe validation (located in `src/lib/schemas/`)
- **Error Handling**: Comprehensive error messages in Czech
- **Type Safety**: Full TypeScript coverage with Prisma-generated types
- **Storage Security**: Private bucket with signed URLs for image access
- **Image Handling**: File paths stored in DB, signed URLs generated on-demand
- **Orders**: Status-driven UI lock and inventory reservations in a single transaction in `updateOrderStatus`
- **Inventory display**: Items grouped by **itemDefinitionId + width + height + thickness** (one row per dimension combo); Celkem / Rezervováno / Dostupné computed per group; status badge reflects group totals (Rezervováno / Částečně rezervováno / Dostupné / Spotřebováno)
- **Order Detail layout**: Separator component and `mt-8` spacing between Order Items table and Material Availability Check section
- **Material check types**: `src/lib/types/order-material.ts` defines `MaterialRequirement` and `MaterialAvailabilityStatus` ('ready' | 'cut_needed' | 'missing') for the order material availability and cut-allocation flow
