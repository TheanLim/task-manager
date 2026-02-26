import { test, expect, type Page } from '@playwright/test';

/**
 * Reproduce: DIT move buttons don't work.
 * Steps: create tasks → navigate to Focus → click DIT → click move buttons
 */

async function addTasksAndNavigateToDIT(page: Page, taskNames: string[]) {
  await page.goto('/');
  await page.waitForTimeout(500);

  // Click "All Tasks" in sidebar
  await page.getByRole('button', { name: /all tasks/i }).click();
  await page.waitForTimeout(500);

  for (const name of taskNames) {
    const addButton = page.getByRole('button', { name: /new task/i });
    await addButton.click();
    await page.waitForTimeout(300);
    const descInput = page.getByLabel(/description/i);
    await descInput.fill(name);
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForTimeout(300);
  }

  // Navigate to Focus (TMS panel) via sidebar
  await page.getByRole('button', { name: /focus/i }).click();
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  // Click DIT tab
  await page.getByRole('tab', { name: /dit/i }).dispatchEvent('click');
  await page.waitForTimeout(500);
}

test.describe('DIT Move Tasks', () => {
  test('clicking "→ Today" on inbox task moves it to Today zone', async ({ page }) => {
    await addTasksAndNavigateToDIT(page, ['Task Alpha', 'Task Beta']);
    const main = page.locator('main');

    // Tasks should be in Inbox (not in today or tomorrow)
    const inboxSection = main.locator('section[aria-label="Inbox"]');
    await expect(inboxSection.getByText('Task Alpha')).toBeVisible({ timeout: 5000 });

    // Click "→ Today" on Task Alpha
    const todayBtn = inboxSection.getByRole('button', { name: /→ Today/i }).first();
    await expect(todayBtn).toBeVisible({ timeout: 3000 });
    await todayBtn.click();
    await page.waitForTimeout(500);

    // Task Alpha should now be in Today zone
    const todaySection = main.locator('section[aria-label="Today"]');
    await expect(todaySection.getByText('Task Alpha')).toBeVisible({ timeout: 5000 });

    // Task Alpha should NOT be in Inbox anymore
    await expect(inboxSection.getByText('Task Alpha')).not.toBeVisible({ timeout: 3000 });
  });

  test('clicking "→ Tomorrow" on inbox task moves it to Tomorrow zone', async ({ page }) => {
    await addTasksAndNavigateToDIT(page, ['Task Gamma']);
    const main = page.locator('main');

    const inboxSection = main.locator('section[aria-label="Inbox"]');
    await expect(inboxSection.getByText('Task Gamma')).toBeVisible({ timeout: 5000 });

    const tomorrowBtn = inboxSection.getByRole('button', { name: /→ Tomorrow/i }).first();
    await tomorrowBtn.click();
    await page.waitForTimeout(500);

    const tomorrowSection = main.locator('section[aria-label="Tomorrow"]');
    await expect(tomorrowSection.getByText('Task Gamma')).toBeVisible({ timeout: 5000 });
  });

  test('clicking "← Today" on tomorrow task moves it to Today zone', async ({ page }) => {
    await addTasksAndNavigateToDIT(page, ['Task Delta']);
    const main = page.locator('main');

    // First move to Tomorrow
    const inboxSection = main.locator('section[aria-label="Inbox"]');
    await inboxSection.getByRole('button', { name: /→ Tomorrow/i }).first().click();
    await page.waitForTimeout(500);

    // Now move from Tomorrow to Today
    const tomorrowSection = main.locator('section[aria-label="Tomorrow"]');
    await expect(tomorrowSection.getByText('Task Delta')).toBeVisible({ timeout: 5000 });
    await tomorrowSection.getByRole('button', { name: /← Today/i }).first().click();
    await page.waitForTimeout(500);

    const todaySection = main.locator('section[aria-label="Today"]');
    await expect(todaySection.getByText('Task Delta')).toBeVisible({ timeout: 5000 });
  });
});
