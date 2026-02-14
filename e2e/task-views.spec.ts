import { test, expect } from '@playwright/test'

async function createProjectWithTask(page: import('@playwright/test').Page) {
  const sidebar = page.locator('aside')
  await sidebar.getByRole('button', { name: /create project/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/name/i).fill('View Test Project')
  await dialog.getByRole('button', { name: /create|save/i }).click()
  await sidebar.getByText('View Test Project').click()

  // Create a task via the header "New Task" button
  await page.locator('header').getByRole('button', { name: /new task/i }).click()
  const taskDialog = page.getByRole('dialog')
  const descInput = taskDialog.locator('input, textarea, [contenteditable]').first()
  await descInput.fill('View test task')
  await taskDialog.getByRole('button', { name: 'Create Task' }).click()
}

test.describe('Task Views - Board', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await createProjectWithTask(page)
  })

  test('can switch to board view and see default sections', async ({ page }) => {
    const main = page.locator('main')

    // Click board tab
    await main.getByRole('tab', { name: /board/i }).click()

    // Board should show default section columns: To Do, Doing, Done
    await expect(main.getByText('To Do').first()).toBeVisible()
    await expect(main.getByText('Doing').first()).toBeVisible()
    await expect(main.getByText('Done').first()).toBeVisible()
  })
})

test.describe('Task Views - Calendar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await createProjectWithTask(page)
  })

  test('can switch to calendar view', async ({ page }) => {
    const main = page.locator('main')

    // Click calendar tab
    await main.getByRole('tab', { name: /calendar/i }).click()

    // Wait for calendar to render — "Today" button is a reliable indicator
    await expect(main.getByRole('button', { name: 'Today' })).toBeVisible({ timeout: 10000 })

    // Calendar should render with day-of-week headers
    await expect(main.getByText('Sun')).toBeVisible()
    await expect(main.getByText('Mon')).toBeVisible()
    await expect(main.getByText('Tue')).toBeVisible()

    // Should show month/year heading
    await expect(main.locator('h2').first()).toBeVisible()
  })

  test('calendar shows day numbers', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('tab', { name: /calendar/i }).click()

    // Calendar should show day numbers
    await expect(main.getByText('1', { exact: true }).first()).toBeVisible()
    await expect(main.getByText('15', { exact: true }).first()).toBeVisible()
  })

  test('calendar has month navigation', async ({ page }) => {
    const main = page.locator('main')
    await main.getByRole('tab', { name: /calendar/i }).click()

    // Get the current month heading text
    const heading = main.locator('h2').first()
    const initialMonth = await heading.textContent()

    // The nav buttons are: [ChevronLeft] [Today] [ChevronRight]
    // Click the Today button's next sibling (ChevronRight)
    const todayBtn = main.getByRole('button', { name: 'Today' })
    await expect(todayBtn).toBeVisible()

    // Use the button after "Today" — the ChevronRight
    const chevronRight = todayBtn.locator('~ button').first()
    await chevronRight.click()

    // Month heading should change
    await expect(heading).not.toHaveText(initialMonth!)
  })
})
