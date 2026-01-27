# Business Logic - Inventory Management System

## Cutting Logic (Guillotine Cut)

The system implements a **guillotine-style cutting** algorithm that simulates real-world material cutting operations.

### Cut Direction

Two cutting directions are supported:

1. **Horizontal Cut** (`direction: "horizontal"`)
   - Cuts along the **width** dimension
   - The cut piece has dimensions: `cutWidth × cutHeight`
   - Remaining material is calculated based on width reduction

2. **Vertical Cut** (`direction: "vertical"`)
   - Cuts along the **height** dimension
   - The cut piece has dimensions: `cutWidth × cutHeight`
   - Remaining material is calculated based on height reduction

### Cut Validation

Before processing a cut:
- Cut width must not exceed original width
- Cut height must not exceed original height
- Original item must have status `AVAILABLE`
- Original item must exist in database

## Remnant Handling

### Main Remnant

The **Main Remnant** is the largest remaining piece after the cut:

**Horizontal Cut:**
- Dimensions: `(originalWidth - cutWidth) × originalHeight × originalThickness`
- This is the piece that remains after cutting off the specified width

**Vertical Cut:**
- Dimensions: `originalWidth × (originalHeight - cutHeight) × originalThickness`
- This is the piece that remains after cutting off the specified height

### Secondary Remnant (Offcut)

The **Secondary Remnant** is a smaller leftover piece that may be created:

**Horizontal Cut:**
- Created when: `cutHeight < originalHeight`
- Dimensions: `cutWidth × (originalHeight - cutHeight) × originalThickness`
- This is the "offcut" - the part of the cut piece that wasn't needed

**Vertical Cut:**
- Created when: `cutWidth < originalWidth`
- Dimensions: `(originalWidth - cutWidth) × cutHeight × originalThickness`
- This is the "offcut" - the part of the cut piece that wasn't needed

### Remnant Creation Rules

- Both remnants are **optional** - user can choose to save or discard each
- Remnants are created with status `REMNANT`
- Remnants link to parent via `parentId` for traceability
- If no remnants are saved, the original item is simply marked as `CONSUMED`

## Pricing

### Unit Price Calculation (Bulk Add)

When adding multiple items with a total price:
```
unitPrice = totalPrice / quantity
```

Each item in the bulk operation receives the calculated unit price.

### Price Distribution (Cutting)

Prices are distributed **proportionally based on area**:

1. **Calculate Areas:**
   ```
   originalArea = originalWidth × originalHeight
   cutArea = cutWidth × cutHeight
   mainRemnantArea = mainRemnantWidth × mainRemnantHeight
   secondaryRemnantArea = secondaryRemnantWidth × secondaryRemnantHeight
   ```

2. **Calculate Prices:**
   ```
   mainRemnantPrice = (originalPrice × mainRemnantArea) / originalArea
   secondaryRemnantPrice = (originalPrice × secondaryRemnantArea) / originalArea
   ```

3. **Cut Piece Price:**
   - The cut piece (consumed portion) has price: `(originalPrice × cutArea) / originalArea`
   - This price is **not stored** (piece is consumed), but can be calculated if needed

**Example:**
- Original: 1000mm × 2000mm, Price: 1000 CZK
- Cut: 500mm × 1000mm
- Original area: 2,000,000 mm²
- Cut area: 500,000 mm² (25% of original)
- Main remnant: 500mm × 2000mm = 1,000,000 mm² (50% of original)
- Main remnant price: 1000 × (1,000,000 / 2,000,000) = 500 CZK

## Naming Convention

### Remnant Naming

All remnants are automatically named with the prefix **"Zbytek z "** (Czech for "Remnant from"):

```
remnantName = "Zbytek z " + originalName
```

**Examples:**
- Original: "Deska" → Remnant: "Zbytek z Deska"
- Original: "Panel 1" → Remnant: "Zbytek z Panel 1"

### Recursive Name Prevention

The system prevents recursive naming patterns like "Zbytek z Zbytek z Deska":

**Current Implementation:**
```typescript
function generateRemnantName(originalName: string): string {
  if (originalName.startsWith('Zbytek z ')) {
    return `Zbytek z ${originalName}`;
  }
  return `Zbytek z ${originalName}`;
}
```

**Note:** The current implementation still allows one level of recursion. If a remnant is cut again, it will create "Zbytek z Zbytek z [name]". This is acceptable for traceability but could be enhanced to prevent all recursion if needed.

## Consume Whole

### Logic

When the cut dimensions **exactly match** the original dimensions:
```
cutWidth === originalWidth && cutHeight === originalHeight
```

The system automatically:
1. **Skips remnant creation** (no remnants are created)
2. **Marks item as CONSUMED** (status changes to `CONSUMED`)
3. **No price calculations needed** (entire item is consumed)

### UI Behavior

- "Spotřebovat celé" (Consume Whole) button fills inputs with max dimensions
- When dimensions match, remnant checkboxes are disabled
- User cannot accidentally create remnants when consuming whole

### Use Case

This feature is useful when:
- An entire sheet/panel is used for a project
- No leftover material remains
- Simplifies the workflow for full consumption

## Data Flow

### Cutting Operation Flow

1. **User Input:**
   - Selects item to cut
   - Enters cut dimensions (width, height)
   - Chooses direction (horizontal/vertical)
   - Selects which remnants to save (checkboxes)

2. **Validation:**
   - Server validates dimensions against original
   - Checks item availability
   - Validates cut dimensions are positive

3. **Calculation:**
   - Calculates main remnant dimensions
   - Calculates secondary remnant dimensions (if applicable)
   - Calculates prices for each remnant

4. **Transaction:**
   - Marks original as `CONSUMED`
   - Creates main remnant (if selected)
   - Creates secondary remnant (if selected)
   - All operations in single database transaction

5. **Response:**
   - Success message in Czech
   - Inventory table refreshes
   - Toast notification shown

## Business Rules Summary

1. **Only AVAILABLE items can be cut**
2. **Cut dimensions cannot exceed original dimensions**
3. **Remnants are optional** - user decides what to save
4. **Prices are area-proportional** - fair distribution of value
5. **Remnants link to parent** - full traceability
6. **Consume Whole bypasses remnant logic** - efficiency for full consumption
7. **Bulk add calculates unit price** - simplifies multi-item entry

---

# Products Module (Výrobky)

## Product Concept

Products represent **finished goods** that are manufactured from inventory items. Each product has:
- Basic information (name, description, selling price)
- Production steps (optional instructions)
- A recipe/Bill of Materials (BOM) specifying which inventory items and quantities are needed
- An optional product image

## Recipe/BOM Logic (Bill of Materials)

### Structure

A **Product** consists of one or more **InventoryItems** with specific quantities:

```
Product = {
  name: "Stůl",
  ingredients: [
    { inventoryItem: "Deska", quantity: 1 },
    { inventoryItem: "Noha stolu", quantity: 4 },
    { inventoryItem: "Šrouby", quantity: 16 }
  ]
}
```

### Key Rules

1. **Minimum Ingredients**: A product must have at least one ingredient
2. **Quantity Requirements**: Each ingredient must have a positive quantity (can be fractional, e.g., 0.5)
3. **Unique Ingredients**: Each inventory item can only appear once per product (enforced by unique constraint)
4. **Available Items Only**: Only inventory items with status `AVAILABLE` can be selected for recipes
5. **Cascade Deletion**: When a product is deleted, all its ingredient relationships are automatically deleted

### Data Model

The relationship is implemented via the `ProductIngredient` join table:

- **productId**: Links to the Product
- **inventoryItemId**: Links to the InventoryItem
- **quantity**: Stores how many units are needed (Float to support fractional quantities)

**Example:**
- Product: "Stůl" (Table)
- Ingredient 1: 1x "Deska" (Board)
- Ingredient 2: 4x "Noha stolu" (Table Leg)
- Ingredient 3: 0.5x "Lepidlo" (Glue)

### Use Cases

- **Manufacturing**: Track which materials are needed to produce a finished product
- **Cost Calculation**: Calculate production costs based on ingredient prices
- **Inventory Planning**: Understand which inventory items are required for production
- **Recipe Management**: Store and manage production recipes/BOMs

## Image Security Logic

### Private Storage

Product images are stored in a **private Supabase Storage bucket** (`products`) to prevent:
- Unauthorized access
- Image scraping
- Direct URL sharing without authentication

### Signed URL Generation

Instead of public URLs, the system uses **temporary signed URLs**:

1. **Storage**: When an image is uploaded:
   - File is stored in the private `products` bucket
   - Only the **file path** (e.g., `1234567890-abc123.jpg`) is stored in the database `photoUrl` field
   - No public URL is generated or stored

2. **Retrieval**: When products are fetched:
   - Server generates a **signed URL** for each product image
   - Signed URLs are valid for **1 hour** (3600 seconds)
   - The temporary URL is included in the API response
   - Frontend receives a working URL that automatically expires

3. **Security Benefits**:
   - Images cannot be accessed without server-side authentication
   - URLs expire after 1 hour, preventing long-term sharing
   - Each request generates a new signed URL
   - Prevents unauthorized scraping or direct access

### Implementation Flow

```
Upload Flow:
1. User selects image → File validation
2. Upload to Supabase Storage (private bucket)
3. Store file path in database (e.g., "1234567890-abc123.jpg")
4. Create product with path

Display Flow:
1. Fetch products from database (includes file paths)
2. For each product with photoUrl:
   - Generate signed URL using supabase.storage.createSignedUrl(path, 3600)
   - Replace path with temporary signed URL
3. Return products to frontend with working URLs
4. URLs expire after 1 hour
```

### Error Handling

- If signed URL generation fails, the product is returned with `photoUrl: null`
- Frontend displays a placeholder image when `photoUrl` is null
- Errors are logged but don't prevent product data from being returned

## Product Creation Flow

1. **User Input:**
   - Enters product name, description, selling price
   - Optionally adds production steps
   - Selects and uploads product image (optional)
   - Adds ingredients via Recipe Editor:
     - Selects inventory item from combobox
     - Enters quantity needed
     - Can add/remove multiple ingredients

2. **Validation:**
   - Product name is required
   - Selling price must be positive
   - At least one ingredient is required
   - Each ingredient must have a valid inventory item and positive quantity
   - Image file type and size validation (if provided)

3. **Image Upload** (if provided):
   - File is validated (type: JPG/PNG/WEBP/GIF, max 5MB)
   - Uploaded to Supabase Storage
   - File path is returned (not a URL)

4. **Transaction:**
   - Product record is created
   - ProductIngredient records are created for each ingredient
   - All operations in a single database transaction

5. **Response:**
   - Success message in Czech
   - Product list refreshes
   - Toast notification shown

## Product Deletion Flow

1. **User Action:**
   - User clicks delete button on a product
   - Confirmation dialog is shown

2. **Deletion Process:**
   - Product record is deleted
   - All ProductIngredient records are deleted (cascade)
   - Associated image is removed from Supabase Storage (if exists)
   - All operations are atomic

3. **Error Handling:**
   - If storage deletion fails, it's logged but doesn't prevent product deletion
   - User is notified of success or failure

## Business Rules Summary - Products

1. **Products require at least one ingredient** - cannot create empty recipes
2. **Only AVAILABLE inventory items can be used** - prevents using consumed/remnant items
3. **Quantities must be positive** - supports fractional quantities (e.g., 0.5)
4. **Images are private by default** - stored in private bucket, accessed via signed URLs
5. **Signed URLs expire after 1 hour** - security measure to prevent long-term sharing
6. **Cascade deletion** - deleting a product removes all ingredient relationships
7. **Transaction-based creation** - ensures data integrity when creating products with ingredients
