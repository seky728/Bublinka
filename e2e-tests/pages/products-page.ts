import { Page, Locator, expect } from '@playwright/test';

export interface CreateProductData {
  name: string;
  sellingPrice: number;
  description?: string;
  productionSteps?: string;
  ingredients: Array<{
    materialName: string;
    quantity: number;
    width?: number;
    height?: number;
  }>;
}

export class ProductsPage {
  readonly page: Page;
  readonly addProductButton: Locator;
  readonly addFirstProductButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.addProductButton = page.getByTestId('products-add-btn');
    this.addFirstProductButton = page.getByTestId('products-add-first-btn');
  }

  /**
   * Navigate to the Products page
   */
  async goto() {
    await this.page.goto('/products');
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Click the "Add Product" button to open the create dialog
   */
  async clickAddProduct() {
    await this.addProductButton.click();
    await this.page.waitForSelector('[data-testid="product-name-input"]', { state: 'visible' });
  }

  /**
   * Fill in the product name
   */
  async fillProductName(name: string) {
    await this.page.getByTestId('product-name-input').fill(name);
  }

  /**
   * Fill in the selling price
   */
  async fillSellingPrice(price: number) {
    await this.page.getByTestId('product-selling-price-input').fill(price.toString());
  }

  /**
   * Fill in the product description (optional)
   */
  async fillDescription(description: string) {
    await this.page.getByTestId('product-description-input').fill(description);
  }

  /**
   * Add an ingredient to the recipe
   */
  async addIngredient() {
    await this.page.getByTestId('recipe-add-ingredient-btn').click();
    await this.page.waitForSelector('[data-testid="recipe-ingredient-row"]', { state: 'visible' });
  }

  /**
   * Select a material from the combobox for an ingredient at the given index
   */
  async selectIngredientMaterial(index: number, materialName: string) {
    // Wait for definitions to load (they're fetched when dialog opens)
    await this.page.waitForTimeout(1000);

    // Click the combobox trigger
    const comboboxTrigger = this.page.getByTestId(`recipe-ingredient-definition-${index}`);
    await comboboxTrigger.click();

    // Wait for the popover to open
    const searchInput = this.page.locator('input[placeholder*="Hledat"]').first();
    await searchInput.waitFor({ state: 'visible', timeout: 5000 });

    // Type to search for the material
    await searchInput.fill(materialName);

    // Wait a moment for filtering
    await this.page.waitForTimeout(500);

    // Click the option
    await this.page.getByText(materialName, { exact: true }).click();
  }

  /**
   * Fill in dimensions for an ingredient at the given index
   */
  async fillIngredientDimensions(index: number, width: number, height: number) {
    // Wait for dimensions inputs to appear (they appear after selecting a sheet material)
    await this.page.waitForSelector(`[data-testid="recipe-ingredient-width-${index}"]`, { state: 'visible' });
    
    await this.page.getByTestId(`recipe-ingredient-width-${index}`).fill(width.toString());
    await this.page.getByTestId(`recipe-ingredient-height-${index}`).fill(height.toString());
  }

  /**
   * Fill in quantity for an ingredient at the given index
   */
  async fillIngredientQuantity(index: number, quantity: number) {
    await this.page.getByTestId(`recipe-ingredient-quantity-${index}`).fill(quantity.toString());
  }

  /**
   * Submit the create product form
   */
  async submitProduct() {
    await this.page.getByTestId('product-submit-btn').click();
    
    // Wait for the dialog to close (explicitly wait for it to disappear)
    await expect(this.page.getByTestId('product-create-dialog')).not.toBeVisible({ timeout: 10000 });
    
    // Wait for network requests to complete
    await this.page.waitForLoadState('networkidle');
  }

  /**
   * Create a product with the given data
   * This is a high-level method that orchestrates the entire creation flow
   */
  async createProduct(data: CreateProductData) {
    await this.clickAddProduct();
    
    await this.fillProductName(data.name);
    await this.fillSellingPrice(data.sellingPrice);
    
    if (data.description) {
      await this.fillDescription(data.description);
    }

    // Add ingredients
    for (let i = 0; i < data.ingredients.length; i++) {
      const ingredient = data.ingredients[i];
      
      // Add ingredient row (always needed, even for the first one)
      await this.addIngredient();

      // Select the material
      await this.selectIngredientMaterial(i, ingredient.materialName);

      // Fill dimensions if provided (for sheet materials)
      if (ingredient.width && ingredient.height) {
        await this.fillIngredientDimensions(i, ingredient.width, ingredient.height);
      }

      // Fill quantity
      await this.fillIngredientQuantity(i, ingredient.quantity);
    }

    // Submit the form
    await this.submitProduct();
  }

  /**
   * Get the product card locator for a specific product name
   */
  getProductCard(productName: string): Locator {
    return this.page.locator('div.border.rounded-lg').filter({ 
      has: this.page.getByRole('heading', { name: productName, exact: true })
    }).first();
  }

  /**
   * Verify that a product is visible in the list
   */
  async verifyProductVisible(productName: string, timeout = 10000) {
    await expect(this.page.getByText(productName)).toBeVisible({ timeout });
  }

  /**
   * Verify product card displays correct data
   */
  async verifyProductCard(productName: string, expectedData: {
    price: number;
    ingredientName: string;
    ingredientDimensions?: { width: number; height: number };
    ingredientQuantity: number;
  }) {
    const productCard = this.getProductCard(productName);
    
    // Verify the product card is visible
    await expect(productCard).toBeVisible({ timeout: 10000 });

    // Verify the product name is displayed in the heading
    await expect(productCard.getByRole('heading', { name: productName, exact: true })).toBeVisible();

    // Verify the price is displayed correctly
    const expectedPriceText = `${expectedData.price.toFixed(2)} Kč`;
    await expect(productCard.getByText(expectedPriceText)).toBeVisible();

    // Verify the ingredient section label is visible
    await expect(productCard.getByText(/Ingredience/)).toBeVisible();

    // Verify the ingredient name is displayed
    await expect(productCard.getByText(expectedData.ingredientName)).toBeVisible();

    // Verify dimensions if provided
    if (expectedData.ingredientDimensions) {
      const dimensionsText = `${expectedData.ingredientDimensions.width} × ${expectedData.ingredientDimensions.height} mm`;
      await expect(productCard.getByText(new RegExp(dimensionsText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeVisible();
    }

    // Verify the quantity is displayed
    await expect(productCard.getByText(new RegExp(`${expectedData.ingredientQuantity} ks`))).toBeVisible();

    // Verify the complete ingredient line format if dimensions are provided
    if (expectedData.ingredientDimensions) {
      const fullIngredientLine = `${expectedData.ingredientName} (${expectedData.ingredientDimensions.width} × ${expectedData.ingredientDimensions.height} mm) – ${expectedData.ingredientQuantity} ks`;
      await expect(productCard.getByText(fullIngredientLine)).toBeVisible();
    }
  }
}
