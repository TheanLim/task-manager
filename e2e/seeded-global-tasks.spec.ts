import { test, expect } from '@playwright/test'
import { seedDatabase } from './fixtures/seed-data'

test.describe('Seeded: Global Tasks View', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/?view=tasks')
  })

  test('shows "Tasks" section with project tasks', async ({ page }) => {
    const main = page.locator('main')
    // The virtual section grouping project tasks is labelled "Tasks"
    await expect(main.getByText('Tasks').first()).toBeVisible()
    // Tasks from both projects should appear
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
    await expect(main.getByText('Beta project kickoff')).toBeVisible()
  })

  test('shows unlinked task outside project sections', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('Personal reminder')).toBeVisible()
  })

  test('shows project column in global view', async ({ page }) => {
    const main = page.locator('main')
    // Project names should appear as column values
    await expect(main.getByText('Seed Project Alpha').first()).toBeVisible()
  })

  test('nested/flat toggle is visible', async ({ page }) => {
    const header = page.locator('header')
    const main = page.locator('main')
    const area = header.or(main)
    await expect(area.getByText(/nested|flat/i).first()).toBeVisible()
  })
})
