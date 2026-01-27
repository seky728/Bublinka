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
│   │   └── inventory.ts  # Inventory CRUD operations
│   ├── inventory/        # Inventory page route
│   │   └── page.tsx      # Main inventory dashboard
│   ├── layout.tsx        # Root layout with Toaster
│   ├── page.tsx          # Homepage (Dashboard)
│   └── globals.css       # Global styles
├── components/            # React components
│   ├── inventory/        # Inventory-specific components
│   │   ├── add-item-dialog.tsx
│   │   └── cut-item-dialog.tsx
│   └── ui/               # shadcn/ui components
│       ├── button.tsx
│       ├── dialog.tsx
│       ├── table.tsx
│       ├── input.tsx
│       └── ... (other UI components)
├── hooks/                # Custom React hooks
│   └── use-toast.ts      # Toast notification hook
└── lib/                  # Utilities and configurations
    ├── prisma.ts         # Prisma client singleton (with PG adapter)
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

### 🔧 Technical Implementation Details

- **Server Actions**: All database operations use Next.js server actions
- **Transactions**: Bulk operations and cuts use Prisma transactions
- **Validation**: Zod schemas for type-safe validation
- **Error Handling**: Comprehensive error messages in Czech
- **Type Safety**: Full TypeScript coverage with Prisma-generated types
