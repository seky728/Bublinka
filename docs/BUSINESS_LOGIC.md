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
