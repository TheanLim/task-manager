import { test, expect } from '@playwright/test';
import { seedDatabase } from './fixtures/seed-data';

test.describe('Share dialog stays open', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page);
    await page.goto('/');
    // Wait for app to hydrate
    await expect(page.locator('header')).toBeVisible();
  });

  test('clicking "Share All Projects" in Data menu opens confirm dialog that stays visible', async ({ page }) => {
    // Click the "Data" button in the header to open the dropdown
    const dataButton = page.locator('header').getByRole('button', { name: /data/i });
    await dataButton.click();

    // Click "Share All Projects" in the dropdown
    const shareItem = page.getByRole('menuitem', { name: /share all projects/i });
    await expect(shareItem).toBeVisible();
    await shareItem.click();

    // The confirm dialog should appear AND stay visible
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // Verify it's the share options dialog (not just a flash)
    await expect(dialog.getByText('Share Options')).toBeVisible();
    await expect(dialog.getByText('Include automations')).toBeVisible();

    // Wait a beat to ensure it doesn't disappear
    await page.waitForTimeout(500);
    await expect(dialog).toBeVisible();
  });
});
