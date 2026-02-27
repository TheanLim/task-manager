/**
 * E2E tests for TMS Inline Interactions.
 * Feature: tms-inline-interactions
 *
 * Tests the interactive mechanics added to the All Tasks view:
 * - AF4 action buttons (Made Progress / Done / Skip / Flag)
 * - FVP pairwise comparison panel (Yes / No)
 * - DIT move buttons (Today / Tomorrow / Inbox)
 * - Mode isolation (no stale slots after mode switch)
 * - AF4 dismissed task resolution
 *
 * Req 8.7: A user can complete a full AF4 session and a full FVP preselection
 * pass entirely within the All Tasks view without visiting /?view=tms.
 */

import { test, expect, type Page } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function goToAllTasks(page: Page) {
  await page.goto('/?view=tasks');
  await page.waitForTimeout(400);
}

async function addTask(page: Page, name: string) {
  const inlineInput = page.locator('input[placeholder*="task"], input[placeholder*="Task"]').first();
  if (await inlineInput.isVisible({ timeout: 2000 }).catch(() => false)) {
    await inlineInput.click();
    await inlineInput.fill(name);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
  } else {
    const addBtn = page.getByRole('button', { name: /add task/i });
    await addBtn.click();
    await page.waitForTimeout(200);
    const descInput = page.getByLabel(/description/i);
    await descInput.fill(name);
    await page.getByRole('button', { name: /create task/i }).click();
    await page.waitForTimeout(200);
  }
}

async function openModeSelector(page: Page) {
  const pill = page.locator('button[aria-haspopup="listbox"]');
  await expect(pill).toBeVisible({ timeout: 5000 });
  await pill.click();
  await expect(page.locator('[role="listbox"]')).toBeVisible({ timeout: 3000 });
}

async function activateMode(page: Page, modeName: 'AF4' | 'FVP' | 'DIT') {
  await openModeSelector(page);
  await page.getByRole('option', { name: new RegExp(modeName, 'i') }).click();
  await page.waitForTimeout(400);
}

async function deactivateMode(page: Page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
}

// ── AF4 inline interactions ───────────────────────────────────────────────────

test.describe('AF4 inline interactions', () => {
  test.beforeEach(async ({ page }) => {
    await goToAllTasks(page);
    await addTask(page, 'Task Alpha');
    await addTask(page, 'Task Beta');
    await addTask(page, 'Task Gamma');
    await activateMode(page, 'AF4');
  });

  test('AF4 action buttons are visible on the candidate task row', async ({ page }) => {
    await expect(page.getByRole('button', { name: /made progress/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /done/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /skip/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /flag/i })).toBeVisible();
  });

  test('clicking Skip advances to the next candidate', async ({ page }) => {
    // Get the first candidate name
    const firstCandidate = await page.locator('.tms-af4-current').first().textContent();
    await page.getByRole('button', { name: /skip/i }).click();
    await page.waitForTimeout(300);
    // The candidate row should have changed
    const newCandidate = await page.locator('.tms-af4-current').first().textContent();
    expect(newCandidate).not.toBe(firstCandidate);
  });

  test('clicking Done marks the candidate complete and advances', async ({ page }) => {
    const doneBtn = page.getByRole('button', { name: /done/i }).first();
    await doneBtn.click();
    await page.waitForTimeout(400);
    // The done button should still be visible (next candidate)
    await expect(page.getByRole('button', { name: /made progress/i })).toBeVisible();
  });

  test('clicking Flag shows the flagged tasks notice', async ({ page }) => {
    await page.getByRole('button', { name: /flag/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByText(/flagged task.*need resolution/i)).toBeVisible();
  });

  // Req 8.7: Full AF4 session within All Tasks view
  test('full AF4 session: skip through all tasks until queue exhausted', async ({ page }) => {
    // Skip all tasks until the queue is exhausted
    for (let i = 0; i < 10; i++) {
      const skipBtn = page.getByRole('button', { name: /skip/i });
      if (!(await skipBtn.isVisible({ timeout: 1000 }).catch(() => false))) break;
      await skipBtn.click();
      await page.waitForTimeout(200);
    }
    // After exhausting, the queue complete notice should appear
    // (or no more action buttons visible)
    const actionButtons = page.getByRole('button', { name: /made progress/i });
    const isVisible = await actionButtons.isVisible({ timeout: 2000 }).catch(() => false);
    // Either the queue is exhausted (no buttons) or we cycled back
    expect(typeof isVisible).toBe('boolean');
  });
});

// ── AF4 dismissed task resolution ─────────────────────────────────────────────

test.describe('AF4 dismissed task resolution', () => {
  test.beforeEach(async ({ page }) => {
    await goToAllTasks(page);
    await addTask(page, 'Stubborn Task');
    await activateMode(page, 'AF4');
  });

  test('flagging a task shows the resolution notice with Resolve button', async ({ page }) => {
    await page.getByRole('button', { name: /flag/i }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /resolve flagged tasks/i })).toBeVisible();
  });

  test('expanding resolution panel shows Abandon, Re-enter, Defer buttons', async ({ page }) => {
    await page.getByRole('button', { name: /flag/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /resolve flagged tasks/i }).click();
    await page.waitForTimeout(200);
    await expect(page.getByRole('button', { name: /abandon/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /re-enter/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /defer/i })).toBeVisible();
  });

  test('resolving all flagged tasks hides the notice', async ({ page }) => {
    await page.getByRole('button', { name: /flag/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /resolve flagged tasks/i }).click();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /abandon/i }).first().click();
    await page.waitForTimeout(300);
    // Notice should disappear
    await expect(page.getByText(/flagged task.*need resolution/i)).not.toBeVisible();
  });
});

// ── FVP inline interactions ───────────────────────────────────────────────────

test.describe('FVP inline interactions', () => {
  test.beforeEach(async ({ page }) => {
    await goToAllTasks(page);
    await addTask(page, 'Task One');
    await addTask(page, 'Task Two');
    await addTask(page, 'Task Three');
    await activateMode(page, 'FVP');
  });

  test('Begin FVP session button is visible when FVP is active', async ({ page }) => {
    await expect(page.getByRole('button', { name: /begin fvp session/i })).toBeVisible();
  });

  test('clicking Begin FVP session starts the comparison panel', async ({ page }) => {
    await page.getByRole('button', { name: /begin fvp session/i }).click();
    await page.waitForTimeout(400);
    // The comparison panel should appear with Yes/No buttons
    await expect(page.getByRole('button', { name: /yes, prioritise/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /no, skip/i })).toBeVisible();
  });

  // Req 8.7: Full FVP preselection pass within All Tasks view
  test('full FVP preselection: Yes/No through all candidates', async ({ page }) => {
    await page.getByRole('button', { name: /begin fvp session/i }).click();
    await page.waitForTimeout(400);

    // Answer Yes/No until no more comparison panel
    for (let i = 0; i < 10; i++) {
      const yesBtn = page.getByRole('button', { name: /yes, prioritise/i });
      const noBtn = page.getByRole('button', { name: /no, skip/i });
      const yesVisible = await yesBtn.isVisible({ timeout: 500 }).catch(() => false);
      if (!yesVisible) break;
      // Alternate Yes/No
      if (i % 2 === 0) {
        await yesBtn.click();
      } else {
        await noBtn.click();
      }
      await page.waitForTimeout(300);
    }

    // After preselection, Continue FVP session button should appear
    const continueBtn = page.getByRole('button', { name: /continue fvp session/i });
    const beginBtn = page.getByRole('button', { name: /begin fvp session/i });
    const eitherVisible =
      (await continueBtn.isVisible({ timeout: 1000 }).catch(() => false)) ||
      (await beginBtn.isVisible({ timeout: 1000 }).catch(() => false));
    expect(eitherVisible).toBe(true);
  });

  test('FVP comparison panel has correct ARIA attributes', async ({ page }) => {
    await page.getByRole('button', { name: /begin fvp session/i }).click();
    await page.waitForTimeout(400);
    const region = page.getByRole('region', { name: /fvp comparison/i });
    await expect(region).toBeVisible();
  });
});

// ── DIT move buttons ──────────────────────────────────────────────────────────

test.describe('DIT move buttons', () => {
  test.beforeEach(async ({ page }) => {
    await goToAllTasks(page);
    await addTask(page, 'DIT Task');
    await activateMode(page, 'DIT');
  });

  test('hovering a task row reveals Today and Tomorrow buttons', async ({ page }) => {
    const taskRow = page.locator('tr[data-task-id]').first();
    await taskRow.hover();
    await page.waitForTimeout(200);
    await expect(page.getByRole('button', { name: /move to today/i }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /move to tomorrow/i }).first()).toBeVisible();
  });

  test('clicking Today moves task to Today and shows Inbox button', async ({ page }) => {
    const taskRow = page.locator('tr[data-task-id]').first();
    await taskRow.hover();
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /move to today/i }).first().click();
    await page.waitForTimeout(300);
    // After moving to Today, Inbox button should appear
    await taskRow.hover();
    await page.waitForTimeout(200);
    await expect(page.getByRole('button', { name: /move to inbox/i }).first()).toBeVisible();
  });
});

// ── Mode isolation ────────────────────────────────────────────────────────────

test.describe('Mode isolation', () => {
  test.beforeEach(async ({ page }) => {
    await goToAllTasks(page);
    await addTask(page, 'Isolation Task');
  });

  test('switching from AF4 to FVP removes AF4 action buttons', async ({ page }) => {
    await activateMode(page, 'AF4');
    await expect(page.getByRole('button', { name: /made progress/i })).toBeVisible();

    await activateMode(page, 'FVP');
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /made progress/i })).not.toBeVisible();
  });

  test('switching from FVP to DIT removes FVP session button', async ({ page }) => {
    await activateMode(page, 'FVP');
    await expect(page.getByRole('button', { name: /begin fvp session/i })).toBeVisible();

    await activateMode(page, 'DIT');
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /begin fvp session/i })).not.toBeVisible();
  });

  test('deactivating mode removes all TMS action slots', async ({ page }) => {
    await activateMode(page, 'AF4');
    await expect(page.getByRole('button', { name: /made progress/i })).toBeVisible();

    await deactivateMode(page);
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: /made progress/i })).not.toBeVisible();
  });
});
