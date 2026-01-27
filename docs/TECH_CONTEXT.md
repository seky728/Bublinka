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

### Key Dependencies
- `@prisma/adapter-pg` - PostgreSQL adapter for Prisma
- `pg` - PostgreSQL client library
- `@radix-ui/*` - UI primitives (Dialog, Toast, Checkbox, Radio, etc.)
- `lucide-react` - Icon library
- `class-variance-authority` - Component variants
- `tailwind-merge` - Tailwind class merging utility

## Project Structure

All code is organized under the `src/` directory:

```
src/
├── app/                    # Next.js App Router
│   ├── actions/           # Server actions
│   │   ├── inventory.ts  # Inventory CRUD operations
│   │   └── products.ts    # Products CRUD operations
│   ├── inventory/        # Inventory page route
│   │   └── page.tsx      # Main inventory dashboard
│   ├── products/         # Products page route
│   │   └── page.tsx      # Products list page
│   ├── layout.tsx        # Root layout with Toaster
│   ├── page.tsx          # Homepage (Dashboard)
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── inventory/        # Inventory-specific components
│   │   ├── add-item-dialog.tsx
│   │   └── cut-item-dialog.tsx
│   ├── products/         # Products-specific components
│   │   ├── create-product-dialog.tsx
│   │   └── recipe-editor.tsx
│   └── ui/               # shadcn/ui components
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── table.tsx
│       ├── input.tsx
│       ├── combobox.tsx
│       ├── textarea.tsx
│       └── ... (other UI components)
├── hooks/                # Custom React hooks
│   └── use-toast.ts      # Toast notification hook
└── lib/                  # Utilities and configurations
    ├── prisma.ts         # Prisma client singleton (with PG adapter)
    ├── supabase.ts       # Supabase client for storage operations
    ├── schemas/          # Zod validation schemas
    │   └── products.ts   # Product validation schemas
    └── utils.ts          # Utility functions (cn helper)
```

### Path Aliases
Configured in `tsconfig.json`:
- `@/*` → `./src/*`

## Database

### Prisma Configuration
- **Provider**: PostgreSQL
- **Adapter**: `@prisma/adapter-pg` (modern driver adapter pattern)
- **Connection**: Via `DATABASE_URL` environment variable (Supabase)
- **Client Location**: `node_modules/@prisma/client`

### InventoryItem Model

```prisma
model InventoryItem {
  id        String           @id @default(uuid())
  name      String
  width     Float            // mm
  height    Float            // mm
  thickness Float            // mm
  price     Float            // unit price in CZK
  status    InventoryStatus  @default(AVAILABLE)
  parentId  String?
  parent    InventoryItem?   @relation("InventoryItemRemnants")
  remnants  InventoryItem[]  @relation("InventoryItemRemnants")
  createdAt DateTime         @default(now())
  updatedAt DateTime         @updatedAt
}
```

**Status Enum:**
- `AVAILABLE` - Item is available for use/cutting
- `CONSUMED` - Item has been fully used
- `REMNANT` - Item is a leftover piece from cutting

**Purpose:**
The InventoryItem model tracks material stock (e.g., wood panels, sheets) with dimensions and pricing. It supports a parent-child relationship to track remnants created from cutting operations.

### Product Model

```prisma
model Product {
  id             String              @id @default(uuid())
  name           String
  description    String?
  photoUrl       String?             // File path in Supabase Storage (not a URL)
  sellingPrice   Float
  productionSteps String?
  ingredients    ProductIngredient[]
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([name])
  @@index([createdAt])
}
```

**Purpose:**
The Product model represents finished goods that are made from inventory items. Products have a selling price and can include production steps. The `photoUrl` field stores the file path (not a full URL) in Supabase Storage.

### ProductIngredient Model (Join Table)

```prisma
model ProductIngredient {
  id              String        @id @default(uuid())
  productId       String
  inventoryItemId String
  quantity        Float         // Quantity needed (e.g., 4.0 for "4x Table Leg")
  product         Product       @relation(fields: [productId], references: [id], onDelete: Cascade)
  inventoryItem   InventoryItem @relation(fields: [inventoryItemId], references: [id], onDelete: Cascade)

  @@unique([productId, inventoryItemId])
  @@index([productId])
  @@index([inventoryItemId])
}
```

**Purpose:**
The ProductIngredient model creates a many-to-many relationship between Products and InventoryItems, representing the Bill of Materials (BOM) or recipe for each product. The `quantity` field stores how many units of each inventory item are needed to create the product.

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
   - Single item creation with name, dimensions, and price
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

4. **Consume Whole** (special cut case)
   - Quick action to consume entire item
   - Detects when cut dimensions match original
   - No remnants created, item marked as CONSUMED

5. **Smart Remnant Naming**
   - Automatic "Zbytek z [OriginalName]" prefix
   - Prevents recursive naming (Zbytek z Zbytek z...)
   - Maintains traceability to parent item

6. **Inventory Dashboard**
   - Table view with all items
   - Status badges (color-coded)
   - Filter by status (implicit via UI)
   - Action buttons per item

7. **UI Components**
   - Add Item Dialog with bulk support
   - Cut Item Dialog with real-time calculations
   - Toast notifications (Czech language)
   - Responsive table layout

8. **Products Module** (`/products`)
   - Product list page with grid view
   - Create Product Dialog with form validation
   - Recipe Editor (BOM) with dynamic ingredient list
   - Image upload with preview
   - Product deletion with cascade cleanup

### Products Server Actions

**Location**: `src/app/actions/products.ts`

1. **`getProducts()`**
   - Fetches all products with their ingredients
   - Generates signed URLs for product images (valid for 1 hour)
   - Returns products with temporary signed URLs for frontend display

2. **`createProduct(data)`**
   - Creates product with basic information
   - Creates ProductIngredient records in a transaction
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

### 🔧 Technical Implementation Details

- **Server Actions**: All database operations use Next.js server actions
- **Transactions**: Bulk operations, cuts, and product creation use Prisma transactions
- **Validation**: Zod schemas for type-safe validation (located in `src/lib/schemas/`)
- **Error Handling**: Comprehensive error messages in Czech
- **Type Safety**: Full TypeScript coverage with Prisma-generated types
- **Storage Security**: Private bucket with signed URLs for image access
- **Image Handling**: File paths stored in DB, signed URLs generated on-demand
