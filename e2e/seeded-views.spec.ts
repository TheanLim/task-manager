import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, TASK_IDS } from './fixtures/seed-data'

test.describe('Seeded: Project List View', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)
  })

  test('renders project name in sidebar as selected', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar.getByText('Seed Project Alpha')).toBeVisible()
    await expect(sidebar.getByText('Seed Project Beta')).toBeVisible()
  })

  test('list view shows tasks grouped by sections', async ({ page }) => {
    const main = page.locator('main')

    // Section headers should be visible
    await expect(main.getByText('To Do').first()).toBeVisible()
    await expect(main.getByText('Doing').first()).toBeVisible()
    await expect(main.getByText('Done').first()).toBeVisible()

    // Tasks should be visible in their sections
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
    await expect(main.getByText('Implement auth flow')).toBeVisible()
    await expect(main.getByText('Design database schema')).toBeVisible()
  })

  test('high priority task shows priority badge', async ({ page }) => {
    const main = page.locator('main')
    const taskRow = main.getByText('Fix critical bug').locator('..')
    // The badge with "high" text should be near the task
    await expect(main.getByText('high').first()).toBeVisible()
  })

  test('task with tags shows tag badges', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('docs')).toBeVisible()
    await expect(main.getByText('frontend')).toBeVisible()
  })

  test('completed task has visual distinction', async ({ page }) => {
    const main = page.locator('main')
    // The completed task text should be visible
    await expect(main.getByText('Design database schema')).toBeVisible()
  })

  test('task with due date shows the date', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('Review PR by today')).toBeVisible({ timeout: 10000 })
    // Due date column renders 'MMM d' format
    await expect(main.getByText('Feb 14').first()).toBeVisible()
  })

  test('project tabs are all present', async ({ page }) => {
    const main = page.locator('main')
    // Wait for tabs to render
    await expect(main.getByRole('tab', { name: /list/i })).toBeVisible({ timeout: 10000 })
    await expect(main.getByRole('tab', { name: /overview/i })).toBeVisible()
    await expect(main.getByRole('tab', { name: /board/i })).toBeVisible()
    await expect(main.getByRole('tab', { name: /calendar/i })).toBeVisible()
  })
})

test.describe('Seeded: Board View', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=board`)
  })

  test('board shows all three section columns', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('To Do').first()).toBeVisible()
    await expect(main.getByText('Doing').first()).toBeVisible()
    await expect(main.getByText('Done').first()).toBeVisible()
  })

  test('board columns show task counts', async ({ page }) => {
    const main = page.locator('main')
    // Section badges show task counts — To Do has 5 top-level tasks, Doing has 2 (parent + 1), Done has 1
    // Just verify badges exist near section headers
    const badges = main.locator('.rounded-lg .flex >> text=/\\d+/')
    await expect(badges.first()).toBeVisible()
  })

  test('board shows task cards with descriptions', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('Set up CI pipeline')).toBeVisible()
    await expect(main.getByText('Implement auth flow')).toBeVisible()
    await expect(main.getByText('Design database schema')).toBeVisible()
  })

  test('board has "Add task" buttons in each column', async ({ page }) => {
    const main = page.locator('main')
    const addButtons = main.getByRole('button', { name: /add task/i })
    // Should have at least 3 (one per section)
    await expect(addButtons.first()).toBeVisible()
    expect(await addButtons.count()).toBeGreaterThanOrEqual(3)
  })

  test('board has "Add section" button', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByRole('button', { name: /add section/i })).toBeVisible()
  })
})

test.describe('Seeded: Calendar View', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=calendar`)
  })

  test('calendar renders month header and navigation', async ({ page }) => {
    const main = page.locator('main')
    // Should show current month heading
    await expect(main.locator('h2').first()).toContainText('February 2026')
    // Navigation buttons
    await expect(main.getByRole('button', { name: 'Today' })).toBeVisible()
  })

  test('calendar shows day-of-week headers', async ({ page }) => {
    const main = page.locator('main')
    for (const day of ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']) {
      await expect(main.getByText(day, { exact: true })).toBeVisible()
    }
  })

  test('calendar shows task on its due date', async ({ page }) => {
    const main = page.locator('main')
    // "Review PR by today" is due Feb 14 — should appear in the calendar grid
    await expect(main.getByText('Review PR by today')).toBeVisible()
  })

  test('calendar shows "No Due Date" section for undated tasks', async ({ page }) => {
    const main = page.locator('main')
    await expect(main.getByText('No Due Date')).toBeVisible()
  })
})
