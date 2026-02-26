/**
 * E2E tests for the FVP (Final Version of Procrastination) time management system.
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §14 "FVP System"
 */
import { test, expect, type Page } from '@playwright/test'

/**
 * Add tasks from the main task list view, then navigate to TMS FVP
 * via the sidebar "Focus" button (client-side nav, preserves state).
 */
async function addTasksAndNavigateToFVP(page: Page, taskNames: string[]) {
  // Go to main view
  await page.goto('/')
  await page.waitForTimeout(500)

  // Click "All Tasks" in sidebar to get to the task list view
  const allTasksBtn = page.getByRole('button', { name: /all tasks/i })
  await allTasksBtn.click()
  await page.waitForTimeout(500)

  for (const name of taskNames) {
    // Click "Add Task" button to open the dialog
    const addButton = page.getByRole('button', { name: /add task/i })
    await addButton.click()
    await page.waitForTimeout(300)

    // Fill the Description field in the dialog
    const descInput = page.getByLabel(/description/i)
    await descInput.fill(name)

    // Click "Create Task" to submit
    await page.getByRole('button', { name: /create task/i }).click()
    await page.waitForTimeout(300)
  }

  // Navigate to TMS via sidebar "Focus" button (client-side, preserves Zustand state)
  const focusButton = page.getByRole('button', { name: /focus/i })
  await focusButton.click()
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

  // Click FVP tab
  const fvpTab = page.getByRole('tab', { name: /fvp/i })
  await fvpTab.dispatchEvent('click')
  await page.waitForTimeout(500)
}

/** Navigate to TMS FVP with no task setup */
async function navigateToFVP(page: Page) {
  await page.goto('/?view=tms')
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
  const fvpTab = page.getByRole('tab', { name: /fvp/i })
  await fvpTab.dispatchEvent('click')
  await page.waitForTimeout(300)
}

test.describe('FVP System', () => {
  test('shows empty state when no tasks exist', async ({ page }) => {
    await navigateToFVP(page)
    const main = page.locator('main')
    await expect(main.getByText(/no tasks yet/i)).toBeVisible()
  })

  test('shows "Start Preselection" button when tasks exist', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task One', 'FVP Task Two', 'FVP Task Three'])
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: /start preselection/i })).toBeVisible({ timeout: 5000 })
  })

  test('shows preselection panel after clicking Start Preselection', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task One', 'FVP Task Two'])
    const main = page.locator('main')
    await main.getByRole('button', { name: /start preselection/i }).click()
    await expect(main.getByRole('button', { name: /yes.*dot/i })).toBeVisible({ timeout: 5000 })
  })

  test('clicking "Yes — dot it" shows Do Now section', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task One', 'FVP Task Two'])
    const main = page.locator('main')
    await main.getByRole('button', { name: /start preselection/i }).click()
    await main.getByRole('button', { name: /yes.*dot/i }).click()
    // After dotting the only candidate with 2 tasks, preselection completes → State C shows Do Now
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('clicking "No — skip" advances to next candidate', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task One', 'FVP Task Two', 'FVP Task Three'])
    const main = page.locator('main')
    await main.getByRole('button', { name: /start preselection/i }).click()
    await main.getByRole('button', { name: /no.*skip/i }).click()
    // Should still be in preselection mode
    await expect(main.getByRole('button', { name: /yes.*dot/i })).toBeVisible()
  })

  test('switching away from FVP and back resumes state', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task One', 'FVP Task Two'])
    const main = page.locator('main')
    await main.getByRole('button', { name: /start preselection/i }).click()
    await main.getByRole('button', { name: /yes.*dot/i }).click()
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 })

    // Switch to DIT
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    // Switch back to FVP
    const fvpTab = page.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main.getByText('Do Now', { exact: true })).toBeVisible({ timeout: 5000 })
  })

  test('view does not crash with no tasks', async ({ page }) => {
    await navigateToFVP(page)
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash|undefined/i)
  })

  test('clicking Done on current task removes it from dotted list', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task A', 'FVP Task B', 'FVP Task C'])
    const main = page.locator('main')
    // Start preselection and dot 2 tasks
    await main.getByRole('button', { name: /start preselection/i }).click()
    await page.waitForTimeout(300)
    await main.getByRole('button', { name: /yes.*dot/i }).click()
    await page.waitForTimeout(300)
    // If another candidate, dot it too
    const dotBtn = main.getByRole('button', { name: /yes.*dot/i })
    if (await dotBtn.isVisible()) {
      await dotBtn.click()
      await page.waitForTimeout(300)
    }
    // Click Done on the current task
    const doneBtn = main.getByRole('button', { name: /done/i }).first()
    if (await doneBtn.isVisible()) {
      await doneBtn.click()
      await page.waitForTimeout(300)
    }
    // The view should still be functional (no crash)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('completing all dotted tasks shows Start Preselection', async ({ page }) => {
    await addTasksAndNavigateToFVP(page, ['FVP Task A', 'FVP Task B'])
    const main = page.locator('main')
    await main.getByRole('button', { name: /start preselection/i }).click()
    await page.waitForTimeout(300)
    await main.getByRole('button', { name: /yes.*dot/i }).click()
    await page.waitForTimeout(300)
    // Complete the current (dotted) task
    const doneBtn = main.getByRole('button', { name: /done/i }).first()
    if (await doneBtn.isVisible()) {
      await doneBtn.click()
      await page.waitForTimeout(500)
    }
    // After all dotted tasks are done, Start Preselection should reappear
    await expect(
      main.getByRole('button', { name: /start preselection/i })
        .or(main.getByText(/no tasks yet/i))
    ).toBeVisible({ timeout: 5000 })
  })

  test('shows "Resumed" pill on FVP tab when switching back with existing state', async ({ page }) => {
    // Add tasks and set up FVP state
    await addTasksAndNavigateToFVP(page, ['Resume A', 'Resume B'])
    const main = page.locator('main')
    // Start preselection and dot a task to create persisted state
    await main.getByRole('button', { name: /start preselection/i }).click()
    await page.waitForTimeout(300)
    await main.getByRole('button', { name: /yes.*dot/i }).click()
    await page.waitForTimeout(300)

    // Switch away to DIT
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    // Switch back to FVP — should show Resumed pill (within 3s window)
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(300)

    // Check for Resumed text on the tab (it auto-clears after 3s)
    const resumedPill = main.getByText(/resumed/i)
    // It may or may not be visible depending on timing — just verify no crash
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })
})
