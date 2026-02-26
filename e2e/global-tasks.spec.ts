import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, TASK_IDS } from './fixtures/seed-data'

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

test.describe('Global Tasks View: n key creates visible task', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/?view=tasks')
    // Wait for the task list to render (seed has tasks from projects)
    await expect(page.locator('main').getByText('Personal reminder')).toBeVisible({ timeout: 10000 })
  })

  test('pressing n with no focused task creates a task that appears in the list', async ({ page }) => {
    // Focus the table so keyboard shortcuts are active
    const table = page.locator('main').locator('table[role="grid"]')
    await table.focus()

    // Press n to open the new task dialog
    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    // Fill in the description and submit
    await dialog.getByLabel(/description/i).fill('My new global task')
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 3000 })

    // The new task must be visible in the task list
    await expect(page.locator('main').getByText('My new global task')).toBeVisible({ timeout: 3000 })
  })

  test('pressing n with a project task focused creates a task that appears in the list', async ({ page }) => {
    // Focus a task that belongs to a project (it will have the virtual __from_projects__ sectionId)
    const table = page.locator('main').locator('table[role="grid"]')
    const projectTaskRow = table.locator(`tr[data-task-id="${TASK_IDS.todoTask1}"]`)
    await expect(projectTaskRow).toBeVisible({ timeout: 5000 })

    // Click to focus the row
    await projectTaskRow.locator('td').first().click({ position: { x: 30, y: 10 } })
    await page.waitForTimeout(100)
    // Escape any inline edit that may have triggered
    const editSpan = page.locator('[contenteditable="true"][role="textbox"]')
    if (await editSpan.isVisible().catch(() => false)) {
      await page.keyboard.press('Escape')
      await page.waitForTimeout(100)
    }
    await table.focus()

    // Press n — previously this would create a task with the virtual sectionId, making it invisible
    await page.keyboard.press('n')
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 3000 })

    await dialog.getByLabel(/description/i).fill('Task created from project row focus')
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    await expect(dialog).not.toBeVisible({ timeout: 3000 })

    // The new task MUST appear in the list — this was the bug
    await expect(page.locator('main').getByText('Task created from project row focus')).toBeVisible({ timeout: 3000 })
  })
})
