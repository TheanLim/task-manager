import { test, expect, type Page } from '@playwright/test';

async function addTasksAndNavigateToAF4(page: Page, taskNames: string[]) {
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

  // Navigate to Focus via sidebar (client-side nav preserves Zustand state)
  await page.getByRole('button', { name: /focus/i }).click();
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  // Click AF4 tab
  await page.getByRole('tab', { name: /af4/i }).dispatchEvent('click');
  await page.waitForTimeout(500);
}

test.describe('AF4 Workflow', () => {
  test('tasks appear in Backlog after activating AF4', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two', 'Task Three']);
    const main = page.locator('main');

    // Backlog section should have tasks
    const backlogSection = main.locator('section[aria-label="Backlog"]');
    await expect(backlogSection).toBeVisible({ timeout: 5000 });
    await expect(backlogSection.getByText('Task One')).toBeVisible({ timeout: 5000 });
    await expect(backlogSection.getByText('Task Two')).toBeVisible();
    await expect(backlogSection.getByText('Task Three')).toBeVisible();
  });

  test('first task in Backlog is highlighted with action buttons', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two']);
    const main = page.locator('main');

    // The current task should have action buttons
    await expect(main.getByRole('button', { name: /made progress/i })).toBeVisible({ timeout: 5000 });
    await expect(main.getByRole('button', { name: /done/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /skip/i })).toBeVisible();
  });

  test('"↺ Made progress" moves task from Backlog to Active List', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two', 'Task Three']);
    const main = page.locator('main');

    // Click Made progress on the first task
    await main.getByRole('button', { name: /made progress/i }).click();
    await page.waitForTimeout(500);

    // Task One should now be in Active List
    const activeSection = main.locator('section[aria-label="Active List"]');
    await expect(activeSection.getByText('Task One')).toBeVisible({ timeout: 5000 });

    // Task Two should now be the current task (highlighted with action buttons)
    await expect(main.getByRole('button', { name: /made progress/i })).toBeVisible();
  });

  test('"→ Skip" advances to next task without moving it', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two', 'Task Three']);
    const main = page.locator('main');

    // Skip the first task
    await main.getByRole('button', { name: /skip/i }).click();
    await page.waitForTimeout(500);

    // Task One should still be in Backlog (not moved)
    const backlogSection = main.locator('section[aria-label="Backlog"]');
    await expect(backlogSection.getByText('Task One')).toBeVisible();

    // Action buttons should still be visible (now on Task Two)
    await expect(main.getByRole('button', { name: /made progress/i })).toBeVisible();
  });

  test('"✓ Done" marks task complete and removes from lists', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two']);
    const main = page.locator('main');

    // Click Done on the first task
    await main.getByRole('button', { name: /✓ done/i }).click();
    await page.waitForTimeout(500);

    // Task One should be gone from Backlog
    const backlogSection = main.locator('section[aria-label="Backlog"]');
    await expect(backlogSection.getByText('Task One')).not.toBeVisible({ timeout: 3000 });

    // Task Two should now be the current task
    await expect(main.getByRole('button', { name: /made progress/i })).toBeVisible();
  });

  test('"⚠" flag shows dismissed task with resolution panel', async ({ page }) => {
    await addTasksAndNavigateToAF4(page, ['Task One', 'Task Two']);
    const main = page.locator('main');

    // Flag the first task
    await main.getByRole('button', { name: /flag as stubborn/i }).click();
    await page.waitForTimeout(500);

    // The flagged task should have a warning icon
    const warningIcon = main.getByLabel(/resolve flagged task/i);
    await expect(warningIcon).toBeVisible({ timeout: 5000 });

    // Click the warning icon to open resolution panel
    await warningIcon.click();
    await page.waitForTimeout(300);

    // Resolution buttons should be visible
    await expect(main.getByRole('button', { name: /abandon/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /re-enter/i })).toBeVisible();
    await expect(main.getByRole('button', { name: /defer/i })).toBeVisible();
  });
});
