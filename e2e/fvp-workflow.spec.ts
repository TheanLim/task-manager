import { test, expect, type Page } from '@playwright/test';

async function addTasksAndNavigateToFVP(page: Page, taskNames: string[]) {
  await page.goto('/');
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: /all tasks/i }).click();
  await page.waitForTimeout(500);

  for (const name of taskNames) {
    await page.getByRole('button', { name: /new task/i }).click();
    await page.waitForTimeout(300);
    await page.getByLabel(/description/i).fill(name);
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForTimeout(300);
  }

  await page.getByRole('button', { name: /focus/i }).click();
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });
  await page.getByRole('tab', { name: /fvp/i }).dispatchEvent('click');
  await page.waitForTimeout(500);
}

test.describe('FVP Workflow', () => {
  test('shows Start Preselection button when tasks exist', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['Task One', 'Task Two']);
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: /start preselection/i })).toBeVisible({ timeout: 5000 });
  });

  test('preselection panel appears after clicking Start Preselection', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['Task One', 'Task Two', 'Task Three']);
    const main = page.locator('main');
    await main.getByRole('button', { name: /start preselection/i }).click();
    await page.waitForTimeout(500);
    await expect(main.getByRole('button', { name: /yes.*dot/i })).toBeVisible({ timeout: 5000 });
    await expect(main.getByRole('button', { name: /no.*skip/i })).toBeVisible();
  });

  test('dotting a task shows Do Now section', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['Task One', 'Task Two']);
    const main = page.locator('main');
    await main.getByRole('button', { name: /start preselection/i }).click();
    await page.waitForTimeout(300);
    await main.getByRole('button', { name: /yes.*dot/i }).click();
    await page.waitForTimeout(500);
    // After dotting the only candidate with 2 tasks, preselection completes → State C shows Do Now
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 });
  });

  test('state persists after switching away and back', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['Task One', 'Task Two']);
    const main = page.locator('main');
    await main.getByRole('button', { name: /start preselection/i }).click();
    await page.waitForTimeout(300);
    await main.getByRole('button', { name: /yes.*dot/i }).click();
    await page.waitForTimeout(300);
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 });

    // Switch to DIT and back
    await page.getByRole('tab', { name: /dit/i }).dispatchEvent('click');
    await page.waitForTimeout(500);
    await page.getByRole('tab', { name: /fvp/i }).dispatchEvent('click');
    await page.waitForTimeout(500);

    // Do Now should still be visible (state preserved)
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 });
  });
});
