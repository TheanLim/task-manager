/**
 * E2E fixture helpers for TMS state seeding.
 *
 * These helpers add tasks via the UI and navigate to TMS tabs,
 * preserving Zustand state through client-side navigation.
 *
 * Ref: Phase 7D.1
 */
import type { Page } from '@playwright/test';

const TAB_NAME_MAP: Record<string, RegExp> = {
  fvp: /fvp/i,
  af4: /af4/i,
  dit: /dit/i,
  none: /review queue/i,
};

/** Add tasks via the "Add Task" dialog in the main task list view. */
export async function addTasksViaUI(page: Page, taskNames: string[]) {
  await page.goto('/');
  await page.waitForTimeout(500);

  const allTasksBtn = page.getByRole('button', { name: /all tasks/i });
  await allTasksBtn.click();
  await page.waitForTimeout(500);

  for (const name of taskNames) {
    const addButton = page.getByRole('button', { name: /add task/i });
    await addButton.click();
    await page.waitForTimeout(300);

    const descInput = page.getByLabel(/description/i);
    await descInput.fill(name);

    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForTimeout(300);
  }
}

/** Navigate to TMS view and click the specified system tab. */
export async function navigateToTMS(page: Page, systemId: string) {
  await page.goto('/?view=tms');
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

  const tabPattern = TAB_NAME_MAP[systemId];
  if (tabPattern) {
    const tab = page.getByRole('tab', { name: tabPattern });
    await tab.dispatchEvent('click');
    await page.waitForTimeout(500);
  }
}

/**
 * Add tasks via UI, then navigate to TMS and click the target tab.
 * Uses client-side nav (sidebar "Focus" button) to preserve Zustand state.
 */
export async function seedAndNavigate(page: Page, systemId: string, taskNames: string[] = []) {
  if (taskNames.length > 0) {
    await addTasksViaUI(page, taskNames);

    // Navigate to TMS via sidebar "Focus" button (client-side, preserves state)
    const focusButton = page.getByRole('button', { name: /focus/i });
    await focusButton.click();
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 });

    const tabPattern = TAB_NAME_MAP[systemId];
    if (tabPattern) {
      const tab = page.getByRole('tab', { name: tabPattern });
      await tab.dispatchEvent('click');
      await page.waitForTimeout(500);
    }
  } else {
    await navigateToTMS(page, systemId);
  }
}

/** Start FVP preselection and dot N tasks. */
export async function setupFVPPreselection(page: Page, dotCount: number) {
  const startBtn = page.getByRole('button', { name: /start preselection/i });
  await startBtn.click();
  await page.waitForTimeout(300);

  for (let i = 0; i < dotCount; i++) {
    const dotBtn = page.getByRole('button', { name: /yes.*dot/i });
    if (await dotBtn.isVisible()) {
      await dotBtn.click();
      await page.waitForTimeout(300);
    }
  }
}

/** Add tasks and navigate to AF4 (tasks go to backlog on init). */
export async function setupAF4Backlog(page: Page, taskNames: string[]) {
  await seedAndNavigate(page, 'af4', taskNames);
}
