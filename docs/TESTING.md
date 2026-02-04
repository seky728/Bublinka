# Testing Documentation

This document describes the E2E testing architecture, best practices, and workflow for the Bublinka ERP project.

## Quick Start

### Running Tests

**Headless Mode (CI/CD):**
```bash
npm run test:e2e
```

**UI Mode (Debugging):**
```bash
npm run test:e2e:ui
```

Both commands automatically reset the test database before running tests.

### Test Structure

Tests are located in the `e2e-tests/` directory:
```
e2e-tests/
├── fixtures.ts              # Custom test fixtures (db, page objects)
├── helpers/
│   └── reset-db.ts         # Database reset utilities
├── pages/
│   └── products-page.ts    # Page Object Model classes
└── *.spec.ts               # Test files
```

## Architecture Overview

### Stack

- **Playwright**: Browser automation and testing framework
- **Prisma**: Database ORM for data seeding and verification
- **TypeScript**: Type-safe test code
- **Page Object Model (POM)**: Encapsulates UI interactions

### Custom Test Fixtures

Our test framework extends Playwright's base test with custom fixtures that provide:

1. **Automatic Database Cleanup**: The `db` fixture automatically resets the database before each test using `TRUNCATE TABLE` with `RESTART IDENTITY CASCADE`.

2. **Database Access**: The `db` fixture provides a PrismaClient instance for direct database operations (seeding, verification).

3. **Page Objects**: Page-specific fixtures (e.g., `productsPage`) provide high-level methods for UI interactions.

**Example:**
```typescript
import { test, expect } from './fixtures';

test('my test', async ({ page, db, productsPage }) => {
  // db: PrismaClient instance
  // productsPage: ProductsPage instance
  // page: Playwright Page instance
});
```

### Page Object Model (POM)

We use the Page Object Model pattern to encapsulate UI interactions and make tests more maintainable.

**Benefits:**
- **Separation of Concerns**: UI logic is separated from test logic
- **Reusability**: Page object methods can be reused across multiple tests
- **Maintainability**: UI changes require updates in one place (the page object)
- **Readability**: Tests focus on "what" rather than "how"

**Example Page Object:**
```typescript
// e2e-tests/pages/products-page.ts
export class ProductsPage {
  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/products');
    await this.page.waitForLoadState('networkidle');
  }

  async createProduct(data: CreateProductData) {
    // Encapsulates all UI interactions for creating a product
  }
}
```

## Best Practices

### 1. Data Seeding: Use Database, Not UI

**❌ DON'T:**
```typescript
// Don't use UI to create prerequisites
await page.goto('/catalog');
await page.getByTestId('catalog-add-btn').click();
// ... fill form via UI
```

**✅ DO:**
```typescript
// Use the db fixture to seed data directly
const material = await db.itemDefinition.create({
  data: {
    name: 'Dubová Deska 18mm',
    category: ItemDefinitionCategory.SHEET_MATERIAL,
  },
});
```

**Why?** 
- Faster: Direct database operations are much faster than UI interactions
- More reliable: No dependency on UI state or timing issues
- Focused: Tests focus on the feature being tested, not prerequisites

### 2. Selectors: Always Use `data-testid`

**❌ DON'T:**
```typescript
await page.locator('button').first().click();
await page.getByText('Submit').click();
```

**✅ DO:**
```typescript
await page.getByTestId('product-submit-btn').click();
```

**Why?**
- Stable: `data-testid` attributes don't change with styling or text changes
- Explicit: Clear intent of what element is being targeted
- Maintainable: Easy to find and update selectors

**Naming Convention:**
- Format: `[context]-[element-role]` in kebab-case
- Examples: `product-submit-btn`, `inventory-add-item-modal`, `order-list-row`

### 3. Cleanup: Let Fixtures Handle It

**❌ DON'T:**
```typescript
test.beforeEach(async () => {
  // Manual cleanup
  await prisma.product.deleteMany();
  await prisma.itemDefinition.deleteMany();
  // ...
});
```

**✅ DO:**
```typescript
// The fixture automatically resets the database before each test
test('my test', async ({ db }) => {
  // Database is already clean!
});
```

**Why?**
- Automatic: No need to remember cleanup logic
- Consistent: Every test starts with a clean database
- Safe: Uses `TRUNCATE TABLE` with proper cascade handling

### 4. Use Page Objects for UI Interactions

**❌ DON'T:**
```typescript
test('create product', async ({ page }) => {
  await page.goto('/products');
  await page.getByTestId('products-add-btn').click();
  await page.getByTestId('product-name-input').fill('Product');
  // ... many more low-level interactions
});
```

**✅ DO:**
```typescript
test('create product', async ({ productsPage }) => {
  await productsPage.goto();
  await productsPage.createProduct({
    name: 'Product',
    sellingPrice: 1000,
    ingredients: [...],
  });
});
```

**Why?**
- Readable: High-level methods express intent clearly
- Maintainable: UI changes only require page object updates
- Reusable: Same methods can be used across multiple tests

## How to Write a New Test

### Step-by-Step Guide

1. **Import fixtures and types:**
```typescript
import { test, expect } from './fixtures';
import { ItemDefinitionCategory } from '@prisma/client';
```

2. **Structure your test using Arrange-Act-Assert pattern:**
```typescript
test('example test', async ({ page, db, productsPage }) => {
  // 1. Arrange: Set up test data using db fixture
  const material = await db.itemDefinition.create({
    data: {
      name: 'Test Material',
      category: ItemDefinitionCategory.SHEET_MATERIAL,
    },
  });

  // 2. Act: Perform actions using page objects
  await productsPage.goto();
  await productsPage.createProduct({
    name: 'Test Product',
    sellingPrice: 1000,
    ingredients: [{
      materialName: 'Test Material',
      quantity: 1,
      width: 1000,
      height: 500,
    }],
  });

  // 3. Assert: Verify results (UI and/or database)
  await productsPage.verifyProductVisible('Test Product');
  
  const savedProduct = await db.product.findFirst({
    where: { name: 'Test Product' },
  });
  expect(savedProduct).not.toBeNull();
});
```

### Complete Example

Here's a complete example from our codebase:

```typescript
import { test, expect } from './fixtures';
import { ItemDefinitionCategory } from '@prisma/client';

test('create product with material ingredient', async ({ productsPage, db }) => {
  // Arrange: Seed prerequisite data
  const material = await db.itemDefinition.create({
    data: {
      name: 'Dubová Deska 18mm',
      category: ItemDefinitionCategory.SHEET_MATERIAL,
      description: 'Test material for product creation',
    },
  });

  const materialId = material.id;

  // Act: Navigate and create product
  await productsPage.goto();
  await productsPage.createProduct({
    name: 'Stůl Dubový',
    sellingPrice: 5000,
    ingredients: [
      {
        materialName: 'Dubová Deska 18mm',
        quantity: 1,
        width: 1000,
        height: 500,
      },
    ],
  });

  // Assert: Verify UI and database
  await productsPage.verifyProductVisible('Stůl Dubový');
  await productsPage.verifyProductCard('Stůl Dubový', {
    price: 5000,
    ingredientName: 'Dubová Deska 18mm',
    ingredientDimensions: { width: 1000, height: 500 },
    ingredientQuantity: 1,
  });

  const savedProduct = await db.product.findFirst({
    where: { name: 'Stůl Dubový' },
    include: {
      ingredients: {
        include: { itemDefinition: true },
      },
    },
  });

  expect(savedProduct).not.toBeNull();
  expect(savedProduct?.name).toBe('Stůl Dubový');
  expect(savedProduct?.sellingPrice).toBe(5000);
});
```

### Creating a New Page Object

If you need to test a new module, create a new page object:

1. **Create the page object file:**
```typescript
// e2e-tests/pages/inventory-page.ts
import { Page } from '@playwright/test';

export class InventoryPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  async goto() {
    await this.page.goto('/inventory');
    await this.page.waitForLoadState('networkidle');
  }

  // Add methods for UI interactions
}
```

2. **Add to fixtures:**
```typescript
// e2e-tests/fixtures.ts
import { InventoryPage } from './pages/inventory-page';

export const test = base.extend<{
  db: PrismaClient;
  productsPage: ProductsPage;
  inventoryPage: InventoryPage; // Add new fixture
}>({
  // ... existing fixtures
  inventoryPage: async ({ page }, use) => {
    const inventoryPage = new InventoryPage(page);
    await use(inventoryPage);
  },
});
```

3. **Use in tests:**
```typescript
test('inventory test', async ({ inventoryPage, db }) => {
  // Use inventoryPage methods
});
```

## Test Database

### Configuration

- **Environment File**: `.env.test` (not committed to git)
- **Database**: Separate test database (configured via `DATABASE_URL` in `.env.test`)
- **Reset Strategy**: `TRUNCATE TABLE` with `RESTART IDENTITY CASCADE` before each test

### Database Reset

The database is automatically reset before each test via the `db` fixture. The reset process:

1. Queries all tables in the `public` schema (excluding `_prisma_migrations`)
2. Executes `TRUNCATE TABLE` with `RESTART IDENTITY CASCADE`
3. Provides a clean slate for each test

**Manual Reset (if needed):**
```bash
npm run db:test:reset
```

## Troubleshooting

### Test Timeouts

If tests are timing out:
- Check that the dev server is running (`npm run dev`)
- Verify database connection in `.env.test`
- Increase timeout in test: `test('name', { timeout: 60000 }, async ({ ... }) => { ... })`

### Database Connection Issues

- Ensure `.env.test` exists and has correct `DATABASE_URL`
- Verify test database is accessible
- Check that Prisma migrations are applied: `npm run db:test:push`

### UI Not Found

- Verify `data-testid` attributes are present in components
- Check that page objects are using correct selectors
- Use Playwright UI mode to debug: `npm run test:e2e:ui`

## Additional Resources

- [Playwright Documentation](https://playwright.dev/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Page Object Model Pattern](https://playwright.dev/docs/pom)
