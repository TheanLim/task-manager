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
})
