import { test, expect } from '@playwright/test'
import { seedDatabase } from './fixtures/seed-data'

test.describe('All Tasks: Header Controls', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/?view=tasks')
  })

  // ── Completed button ────────────────────────────────────────────────────

  test('shows Completed button with threshold label', async ({ page }) => {
    const main = page.locator('main')
    const completedBtn = main.getByRole('button', { name: /^Completed/i })
    await expect(completedBtn).toBeVisible()
    await expect(completedBtn).toContainText(/completed/i)
  })

  test('Completed popover opens with Completed tasks label and dropdown', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')

    await expect(popover.getByText('Completed tasks')).toBeVisible()
    // No checkbox — the old "Hide all completed" is gone
    await expect(popover.getByRole('checkbox')).not.toBeVisible()
    // Dropdown present
    await expect(popover.getByRole('combobox')).toBeVisible()
  })

  test('dropdown contains all five options', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()

    await expect(page.getByRole('option', { name: 'Show all' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Hide after 24 hours' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Hide after 48 hours' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Hide after 1 week' })).toBeVisible()
    await expect(page.getByRole('option', { name: 'Always hide' })).toBeVisible()
  })

  // ── Always hide ─────────────────────────────────────────────────────────

  test('Always hide hides all completed tasks', async ({ page }) => {
    const main = page.locator('main')

    await expect(main.getByText('Design database schema')).toBeVisible()

    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Always hide' }).click()
    await page.keyboard.press('Escape')

    await expect(main.getByText('Design database schema')).not.toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  test('Always hide shows Completed · Hidden in button label', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Always hide' }).click()
    await page.keyboard.press('Escape')

    await expect(main.getByRole('button', { name: /Completed · Hidden/i })).toBeVisible()
  })

  test('Always hide hides the Show recently completed button', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Always hide' }).click()

    await expect(popover.getByRole('button', { name: /show recently completed/i })).not.toBeVisible()
  })

  // ── Show all ────────────────────────────────────────────────────────────

  test('Show all makes all completed tasks visible and hides toggle', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Show all' }).click()
    await page.keyboard.press('Escape')

    // Both recent and aged-out completed tasks visible
    await expect(main.getByText('Design database schema')).toBeVisible()
    await expect(main.getByText('Old completed task')).toBeVisible()

    // Toggle not shown — redundant when everything is visible
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover2 = page.locator('[data-radix-popper-content-wrapper]')
    await expect(popover2.getByRole('button', { name: /show recently completed/i })).not.toBeVisible()
  })

  test('Show all shows Completed · All in button label', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Show all' }).click()
    await page.keyboard.press('Escape')

    await expect(main.getByRole('button', { name: /Completed · All/i })).toBeVisible()
  })

  // ── Time-based threshold ────────────────────────────────────────────────

  test('Hide after 24 hours auto-hides aged-out tasks, shows recent ones', async ({ page }) => {
    const main = page.locator('main')
    // Default is already 24h — aged-out task should be hidden, recent visible
    await expect(main.getByText('Design database schema')).toBeVisible()
    await expect(main.getByText('Old completed task')).not.toBeVisible()
  })

  test('Show recently completed button visible for time-based thresholds', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')

    // Default 24h — toggle should be visible
    await expect(popover.getByRole('button', { name: /show recently completed/i })).toBeVisible()
  })

  test('Show recently completed shows only tasks within threshold, hides incomplete', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('button', { name: /show recently completed/i }).click()
    await page.keyboard.press('Escape')

    // Recent completed (1h ago) — visible
    await expect(main.getByText('Design database schema')).toBeVisible()
    // Aged-out (3 days) — NOT visible (threshold respected)
    await expect(main.getByText('Old completed task')).not.toBeVisible()
    // Incomplete — NOT visible
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()
  })

  test('Show recently completed shows Completed · Recent in button label', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('button', { name: /show recently completed/i }).click()
    await page.keyboard.press('Escape')

    await expect(main.getByRole('button', { name: /Completed · Recent/i })).toBeVisible()
  })

  test('Switching to Always hide resets Show recently completed', async ({ page }) => {
    const main = page.locator('main')

    // Enable show recently completed
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover = page.locator('[data-radix-popper-content-wrapper]')
    await popover.getByRole('button', { name: /show recently completed/i }).click()
    await page.keyboard.press('Escape')

    // Confirm mode active — incomplete hidden
    await expect(main.getByText('Set up CI pipeline')).not.toBeVisible()

    // Switch to Always hide
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover2 = page.locator('[data-radix-popper-content-wrapper]')
    await popover2.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Always hide' }).click()
    await page.keyboard.press('Escape')

    // Completed hidden, incomplete visible
    await expect(main.getByText('Design database schema')).not.toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()

    // Switch back to 24h — showRecentlyCompleted was reset, normal view resumes
    await main.getByRole('button', { name: /^Completed/i }).click()
    const popover3 = page.locator('[data-radix-popper-content-wrapper]')
    await popover3.getByRole('combobox').click()
    await page.getByRole('option', { name: 'Hide after 24 hours' }).click()
    await page.keyboard.press('Escape')

    // Both completed (recent) and incomplete visible — not stuck in recently completed mode
    await expect(main.getByText('Design database schema')).toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  // ── Review Queue ────────────────────────────────────────────────────────

  test('Review Queue toggle shows Reviewing state and hides Completed button', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: /^Completed/i })).toBeVisible()

    await main.getByRole('button', { name: /review queue/i }).click()
    await expect(main.getByRole('button', { name: /reviewing/i })).toBeVisible()
    await expect(main.getByRole('button', { name: /^Completed/i })).not.toBeVisible()
    await expect(main.getByText(/sorted by last reviewed/i)).toBeVisible()
  })

  test('Review Queue hides completed tasks', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('Design database schema')).toBeVisible()

    await main.getByRole('button', { name: /review queue/i }).click()
    await expect(main.getByText('Design database schema')).not.toBeVisible()
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
  })

  test('Review Queue disables on column sort click', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /review queue/i }).click()
    await expect(main.getByRole('button', { name: /reviewing/i })).toBeVisible()

    await main.locator('thead tr').first().getByText('Priority').click()
    await expect(main.getByRole('button', { name: /review queue/i })).toBeVisible()
  })

  // ── Nested/Flat ─────────────────────────────────────────────────────────

  test('Nested/Flat toggle switches display mode', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: /nested/i })).toBeVisible()

    await main.getByRole('button', { name: /nested/i }).click()
    await expect(main.getByRole('button', { name: /flat/i })).toBeVisible()

    await main.getByRole('button', { name: /flat/i }).click()
    await expect(main.getByRole('button', { name: /nested/i })).toBeVisible()
  })

  // ── Reinsert ────────────────────────────────────────────────────────────

  test('Reinsert button appears on task rows in Review Queue mode', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('button', { name: /review queue/i }).click()

    const row = main.locator('tr', { has: page.getByText('Set up CI pipeline') }).first()
    await row.hover()
    await expect(row.getByLabel('Move to bottom')).toBeVisible()
  })

  test('Reinsert button does NOT appear in normal mode', async ({ page }) => {
    const main = page.locator('main')
    const row = main.locator('tr', { has: page.getByText('Set up CI pipeline') }).first()
    await row.hover()
    await expect(row.getByLabel('Move to bottom')).not.toBeVisible()
  })
})
