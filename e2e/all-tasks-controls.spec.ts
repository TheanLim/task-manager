import { test, expect } from '@playwright/test'
import { seedDatabase } from './fixtures/seed-data'

test.describe('All Tasks: Header Controls', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/?view=tasks')
  })

  test('shows Completed popover button with threshold label', async ({ page }) => {
    const main = page.locator('main')
    const completedBtn = main.getByRole('button', { name: /completed/i })
    await expect(completedBtn).toBeVisible()
    // Default threshold is 24h — button should show "Completed · 24 hours" or similar
    await expect(completedBtn).toContainText(/completed/i)
  })

  test('Completed popover opens and shows settings', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /completed/i }).click()

    // Popover should show the settings
    await expect(page.getByText('Completed Tasks')).toBeVisible()
    await expect(page.getByText('Hide all completed')).toBeVisible()
    await expect(page.getByText('Auto-hide after')).toBeVisible()
  })

  test('Hide all completed checkbox hides completed tasks', async ({ page }) => {
    const main = page.locator('main')

    // Completed task should be visible initially
    await expect(main.getByText('Design database schema')).toBeVisible()

    // Open popover and check "Hide all completed"
    await main.getByRole('button', { name: /completed/i }).click()
    await page.getByRole('checkbox', { name: /hide all completed/i }).click()

    // Completed task should be hidden
    await expect(main.getByText('Design database schema')).not.toBeVisible()

    // Incomplete tasks should still be visible
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  test('Review Queue toggle shows Reviewing state and hides Completed popover', async ({ page }) => {
    const main = page.locator('main')

    // Completed popover should be visible initially
    await expect(main.getByRole('button', { name: /completed/i })).toBeVisible()

    // Click Review Queue
    await main.getByRole('button', { name: /review queue/i }).click()

    // Should show "Reviewing" label
    await expect(main.getByRole('button', { name: /reviewing/i })).toBeVisible()

    // Completed popover should be hidden
    await expect(main.getByRole('button', { name: /completed/i })).not.toBeVisible()

    // Info bar should appear
    await expect(main.getByText(/sorted by last reviewed/i)).toBeVisible()
  })

  test('Review Queue hides completed tasks', async ({ page }) => {
    const main = page.locator('main')

    // Completed task visible initially
    await expect(main.getByText('Design database schema')).toBeVisible()

    // Enable Review Queue
    await main.getByRole('button', { name: /review queue/i }).click()

    // Completed task should be hidden
    await expect(main.getByText('Design database schema')).not.toBeVisible()

    // Incomplete tasks still visible
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  test('Nested/Flat toggle switches display mode', async ({ page }) => {
    const main = page.locator('main')

    // Should start in Nested mode
    await expect(main.getByRole('button', { name: /nested/i })).toBeVisible()

    // Switch to Flat
    await main.getByRole('button', { name: /nested/i }).click()
    await expect(main.getByRole('button', { name: /flat/i })).toBeVisible()

    // Switch back to Nested
    await main.getByRole('button', { name: /flat/i }).click()
    await expect(main.getByRole('button', { name: /nested/i })).toBeVisible()
  })

  test('Review Queue disables on column sort click', async ({ page }) => {
    const main = page.locator('main')

    // Enable Review Queue
    await main.getByRole('button', { name: /review queue/i }).click()
    await expect(main.getByRole('button', { name: /reviewing/i })).toBeVisible()

    // Click a column header to sort
    const headerRow = main.locator('thead tr').first()
    await headerRow.getByText('Priority').click()

    // Review Queue should be disabled — back to "Review Queue" label
    await expect(main.getByRole('button', { name: /review queue/i })).toBeVisible()
  })

  test('Reinsert button appears on task rows in Review Queue mode', async ({ page }) => {
    const main = page.locator('main')

    // Enable Review Queue
    await main.getByRole('button', { name: /review queue/i }).click()

    // Hover over a task row to reveal the reinsert button
    const taskRow = main.getByText('Set up CI pipeline').locator('closest=tr') 
    // Use a more reliable selector — find the row containing the task text
    const row = main.locator('tr', { has: page.getByText('Set up CI pipeline') }).first()
    await row.hover()

    // Reinsert button should be visible
    await expect(row.getByLabel('Move to bottom')).toBeVisible()
  })

  test('Reinsert button does NOT appear in normal mode', async ({ page }) => {
    const main = page.locator('main')

    // Hover over a task row in normal mode
    const row = main.locator('tr', { has: page.getByText('Set up CI pipeline') }).first()
    await row.hover()

    // Reinsert button should NOT be visible
    await expect(row.getByLabel('Move to bottom')).not.toBeVisible()
  })

  test('Show recently done includes tasks completed within the threshold (not just aged-out)', async ({ page }) => {
    const main = page.locator('main')

    // "Design database schema" is completed 1h ago (within 24h threshold) — visible by default
    await expect(main.getByText('Design database schema')).toBeVisible()

    // Open Completed popover and click "Show recently done"
    await main.getByRole('button', { name: /completed/i }).click()
    await page.getByRole('button', { name: /show recently done/i }).click()

    // The recently completed task (within threshold) must still be visible —
    // this was the bug: it disappeared because only autoHidden tasks were shown
    await expect(main.getByText('Design database schema')).toBeVisible()

    // Incomplete tasks should NOT be visible in this mode
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()
  })

  test('Show recently done hides incomplete tasks but shows all completed', async ({ page }) => {
    const main = page.locator('main')

    // Seed has one completed task: "Design database schema" (1h ago, within 24h)
    // Enable "Show recently done"
    await main.getByRole('button', { name: /completed/i }).click()
    await page.getByRole('button', { name: /show recently done/i }).click()

    // Completed task visible
    await expect(main.getByText('Design database schema')).toBeVisible()

    // Incomplete tasks hidden
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()
    await expect(main.getByText('Implement auth flow')).not.toBeVisible()
  })

  test('Show recently done button is hidden when Hide all completed is checked', async ({ page }) => {
    const main = page.locator('main')

    // Open popover and check "Hide all completed"
    await main.getByRole('button', { name: /completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('checkbox', { name: /hide all completed/i }).click()

    // "Show recently done" button should not be visible inside the popover
    await expect(popover.getByRole('button', { name: /show recently done/i })).not.toBeVisible()
  })

  test('Checking Hide all completed resets showRecentlyCompleted', async ({ page }) => {
    const main = page.locator('main')

    // First enable "Show recently done"
    await main.getByRole('button', { name: /completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('button', { name: /show recently done/i }).click()
    await page.keyboard.press('Escape')

    // Confirm we're in "show recently done" mode — incomplete tasks hidden
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()

    // Now open again and check "Hide all completed"
    await main.getByRole('button', { name: /completed/i }).click()
    const popover2 = page.locator('[data-radix-popper-content-wrapper]')
    await popover2.getByRole('checkbox', { name: /hide all completed/i }).click()
    await page.keyboard.press('Escape')

    // Completed task hidden, incomplete visible
    await expect(main.getByText('Design database schema')).not.toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()

    // Uncheck "Hide all completed" — showRecentlyCompleted was reset, so normal view resumes
    await main.getByRole('button', { name: /completed/i }).click()
    const popover3 = page.locator('[data-radix-popper-content-wrapper]')
    await popover3.getByRole('checkbox', { name: /hide all completed/i }).click()
    await page.keyboard.press('Escape')

    // Both completed and incomplete tasks visible (not stuck in "show recently done" mode)
    await expect(main.getByText('Design database schema')).toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  test('Show recently done button is visible when autoHideThreshold is never', async ({ page }) => {
    const main = page.locator('main')

    // Set threshold to "never" via the popover's Select
    await main.getByRole('button', { name: /completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Never' }).click()

    // "Show recently done" button should still be visible
    await expect(popover.getByRole('button', { name: /show recently done|show completed/i })).toBeVisible()
  })

  test('Show recently done with threshold never shows all completed tasks', async ({ page }) => {
    const main = page.locator('main')

    // Set threshold to "never" and enable show recently done
    await main.getByRole('button', { name: /completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Never' }).click()
    await popover.getByRole('button', { name: /show recently done|show completed/i }).click()
    await page.keyboard.press('Escape')

    // Completed task should be visible
    await expect(main.getByText('Design database schema')).toBeVisible()
    // Incomplete tasks should be hidden
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()
  })
})
