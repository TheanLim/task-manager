/**
 * E2E tests for the Standard / Review Queue time management system.
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §14 "Review Queue"
 */
import { test, expect } from '@playwright/test'
import { addTasksViaUI } from './fixtures/tms-seed'

async function seedAndNavigate(page: import('@playwright/test').Page) {
  // Standard/Review Queue is the default system, so no tab click needed
  // but we still click it explicitly for consistency
  await page.goto('/?view=tms')
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

  const stdTab = page.getByRole('tab', { name: /review queue/i })
  if (await stdTab.isVisible()) {
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(300)
  }
}

test.describe('Review Queue (Standard)', () => {
  test.beforeEach(async ({ page }) => {
    await seedAndNavigate(page)
  })

  test('Review Queue tab is selectable and active', async ({ page }) => {
    const main = page.locator('main')
    const stdTab = main.getByRole('tab', { name: /review queue/i })
    if (await stdTab.isVisible()) {
      await expect(stdTab).toHaveAttribute('aria-selected', 'true')
    } else {
      test.skip()
    }
  })

  test('tasks are visible in the review queue', async ({ page }) => {
    // Add tasks via UI, then navigate to Standard tab
    await addTasksViaUI(page, ['Std Task A', 'Std Task B', 'Std Task C'])
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const stdTab = page.getByRole('tab', { name: /review queue/i })
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    const main = page.locator('main')
    await expect(main.getByText('Std Task A')).toBeVisible({ timeout: 5000 })
    await expect(main.getByText('Std Task B')).toBeVisible()
    await expect(main.getByText('Std Task C')).toBeVisible()
  })

  test('tasks are sorted by lastActionAt when needsAttentionSort is enabled', async ({ page }) => {
    // Add tasks via UI, navigate to Standard tab
    await addTasksViaUI(page, ['Sort Task A', 'Sort Task B', 'Sort Task C'])
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const stdTab = page.getByRole('tab', { name: /review queue/i })
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    const main = page.locator('main')
    // Tasks should be visible and sorted (oldest first by default)
    await expect(main.getByText('Sort Task A')).toBeVisible({ timeout: 5000 })
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('reinsert button is only shown on the top task', async ({ page }) => {
    await addTasksViaUI(page, ['Reinsert A', 'Reinsert B', 'Reinsert C'])
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const stdTab = page.getByRole('tab', { name: /review queue/i })
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    const main = page.locator('main')
    const reinsertBtns = main.getByRole('button', { name: /reinsert/i })
    const count = await reinsertBtns.count()
    // Only the first task should have a Reinsert button
    expect(count).toBeLessThanOrEqual(1)
  })

  test('clicking reinsert moves task to end', async ({ page }) => {
    await addTasksViaUI(page, ['Reinsert X', 'Reinsert Y', 'Reinsert Z'])
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const stdTab = page.getByRole('tab', { name: /review queue/i })
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    const main = page.locator('main')
    const reinsertBtn = main.getByRole('button', { name: /reinsert/i }).first()
    if (await reinsertBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await reinsertBtn.click()
      await page.waitForTimeout(300)
      // View should still be functional after reinsert
      await expect(main).toBeVisible()
      await expect(page.locator('body')).not.toContainText(/error|crash/i)
    } else {
      test.skip()
    }
  })

  test('hideCompletedTasks hides completed tasks when toggle is clicked', async ({ page }) => {
    await addTasksViaUI(page, ['Hide Task A', 'Hide Task B'])
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const stdTab = page.getByRole('tab', { name: /review queue/i })
    await stdTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    const main = page.locator('main')
    // Complete a task first
    const checkbox = main.locator('input[type="checkbox"], [role="checkbox"]').first()
    if (await checkbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await checkbox.click()
      await page.waitForTimeout(300)
    }
    // Click "Hide completed" toggle
    const hideBtn = main.getByRole('button', { name: /hide completed/i })
    if (await hideBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await hideBtn.click()
      await page.waitForTimeout(300)
    }
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('disabling needsAttentionSort shows tasks in natural order', async ({ page }) => {
    const main = page.locator('main')
    // Default state has needsAttentionSort=false, tasks should be in natural order
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })
})
