import { test as base } from '@playwright/test';
import { PrismaClient } from '@prisma/client';
import { getPrismaClient, resetDatabase } from './helpers/reset-db';
import { ProductsPage } from './pages/products-page';

// Extend the base test with custom fixtures
export const test = base.extend<{
  db: PrismaClient;
  productsPage: ProductsPage;
}>({
  db: async ({}, use) => {
    // Reset database before each test
    await resetDatabase();

    // Get the prisma client instance
    const prisma = getPrismaClient();

    // Pass the client to the test
    await use(prisma);

    // Note: We don't disconnect here because the client is reused
    // The connection will be cleaned up when the test process exits
  },
  productsPage: async ({ page }, use) => {
    // Initialize the ProductsPage with the page instance
    const productsPage = new ProductsPage(page);
    await use(productsPage);
  },
});

export { expect } from '@playwright/test';
