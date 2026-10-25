import { expect, test } from '@playwright/test';

test.describe('Persistent guest cart', () => {
  test('adds a product, updates quantity, survives reload, and removes it', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();

    const increaseQuantity = page.locator('button[aria-label^="Increase quantity of"]').first();
    const increaseLabel = await increaseQuantity.getAttribute('aria-label');
    const productName = increaseLabel?.replace('Increase quantity of ', '');
    if (!productName) {
      throw new Error('Could not identify a product in the catalog');
    }

    await increaseQuantity.click();
    await page.getByRole('button', { name: `Add 1 ${productName} to cart` }).click();
    await expect(page.getByRole('status')).toContainText('Product added to your cart.');

    await page.getByRole('navigation').getByRole('link', { name: 'My Cart' }).click();
    await expect(page.getByRole('heading', { name: 'My Cart' })).toBeVisible();
    const quantityLabel = `Quantity of ${productName}`;
    await expect(page.getByLabel(quantityLabel, { exact: true })).toHaveText('1');

    await page.getByRole('button', { name: `Increase quantity of ${productName}` }).click();
    await expect(page.getByLabel(quantityLabel, { exact: true })).toHaveText('2');

    await page.reload();
    await expect(page.getByLabel(quantityLabel, { exact: true })).toHaveText('2');

    await page.getByRole('button', { name: `Remove ${productName} from cart` }).click();
    await expect(page.getByText('Your cart is empty.')).toBeVisible();
  });
});
