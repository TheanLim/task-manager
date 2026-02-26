import { test, expect } from '@playwright/test'
import { seedDatabase, TASK_IDS } from './fixtures/seed-data'

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

test.describe('Global Tasks View: task creation', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/?view=tasks')
    // Wait for the task list to render (seed has tasks from projects)
    await expect(page.locator('main').getByText('Personal reminder')).toBeVisible({ timeout: 10000 })
  })

  test('pressing n with no focused task creates a task that appears in the list', async ({ page }) => {
    const table = page.locator('main').locator('table[role="grid"]')
    await table.focus()

    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    await dialog.getByLabel(/description/i).fill('My new global task')
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    await expect(dialog).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('main').getByText('My new global task')).toBeVisible({ timeout: 3000 })
  })

  test('clicking "Add tasks..." in the Tasks section creates a task that appears in the list', async ({ page }) => {
    const main = page.locator('main')
    const table = main.locator('table[role="grid"]')

    // Click the add-task row inside the Tasks (virtual) section
    const addRow = table.locator('tr').filter({ hasText: /add tasks/i }).first()
    await addRow.hover()
    await addRow.click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    await dialog.getByLabel(/description/i).fill('Task added via Tasks section')
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    await expect(dialog).not.toBeVisible({ timeout: 3000 })
    // Must appear in the list — not lost to the virtual __from_projects__ sectionId
    await expect(main.getByText('Task added via Tasks section')).toBeVisible({ timeout: 3000 })
  })

  test('pressing n with a project task focused creates a task that appears in the list', async ({ page }) => {
    const table = page.locator('main').locator('table[role="grid"]')
    const projectTaskRow = table.locator(`tr[data-task-id="${TASK_IDS.todoTask1}"]`)
    await expect(projectTaskRow).toBeVisible({ timeout: 5000 })

    await projectTaskRow.locator('td').first().click({ position: { x: 30, y: 10 } })
    await page.waitForTimeout(100)
    const editSpan = page.locator('[contenteditable="true"][role="textbox"]')
    if (await editSpan.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)
    }
    await table.focus()

    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    await dialog.getByLabel(/description/i).fill('Task created from project row focus')
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    await expect(dialog).not.toBeVisible({ timeout: 3000 })
    await expect(page.locator('main').getByText('Task created from project row focus')).toBeVisible({ timeout: 3000 })
  })
})
