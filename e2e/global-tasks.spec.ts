import { test, expect } from '@playwright/test'

test.describe('Global Tasks View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('can navigate to All Tasks view', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Look for "All Tasks" link/button in sidebar
    const allTasksLink = sidebar.getByText(/all tasks/i)
    await expect(allTasksLink).toBeVisible()
    await allTasksLink.click()

    // Should show global tasks header or empty state
    const main = page.locator('main')
    await expect(main.getByText(/no tasks|all tasks/i).first()).toBeVisible()
  })

  test('global tasks view shows display mode toggle', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByText(/all tasks/i).click()

    // Should have nested/flat toggle
    const main = page.locator('main')
    const header = page.locator('header')
    const toggleArea = main.or(header)

    // Look for display mode controls (nested/flat)
    const nestedOrFlat = toggleArea.getByText(/nested|flat/i)
    await expect(nestedOrFlat.first()).toBeVisible()
  })
})
