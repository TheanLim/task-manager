import { test, expect } from '@playwright/test'

/**
 * Helper: create a project and navigate to it
 */
async function createProjectAndNavigate(page: import('@playwright/test').Page, name: string) {
  const sidebar = page.locator('aside')
  await sidebar.getByRole('button', { name: /create project/i }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel(/name/i).fill(name)
  await dialog.getByRole('button', { name: /create|save/i }).click()
  await expect(dialog).not.toBeVisible()
  await sidebar.getByText(name).click()
  // Wait for project view to load
  await expect(page.locator('main').getByRole('tab', { name: /list/i })).toBeVisible({ timeout: 10000 })
}

test.describe('Task Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('"New Task" button appears in header when project is active', async ({ page }) => {
    await createProjectAndNavigate(page, 'Task Test Project')

    // "New Task" button in header (text visible on sm+ viewports)
    const header = page.locator('header')
    await expect(header.getByRole('button', { name: /new task/i })).toBeVisible({ timeout: 10000 })
  })

  test('can open the new task dialog', async ({ page }) => {
    await createProjectAndNavigate(page, 'Dialog Test Project')

    // Click "New Task" in header
    const header = page.locator('header')
    await header.getByRole('button', { name: /new task/i }).click()

    // Task dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()
  })

  test('task dialog has required fields', async ({ page }) => {
    await createProjectAndNavigate(page, 'Fields Test Project')

    await page.locator('header').getByRole('button', { name: /new task/i }).click()

    const dialog = page.getByRole('dialog')

    // Should have description/title input
    const descInput = dialog.locator('input, textarea, [contenteditable]').first()
    await expect(descInput).toBeVisible()

    // Should have priority selector
    await expect(dialog.getByText(/priority/i)).toBeVisible()

    // Should have save/create button
    await expect(dialog.getByRole('button', { name: 'Create Task' })).toBeVisible()
  })

  test('can create a task and see it in the list', async ({ page }) => {
    await createProjectAndNavigate(page, 'Create Task Project')

    await page.locator('header').getByRole('button', { name: /new task/i }).click()

    const dialog = page.getByRole('dialog')

    // Fill in task description
    const descInput = dialog.locator('input, textarea, [contenteditable]').first()
    await descInput.fill('My first test task')

    // Submit
    await dialog.getByRole('button', { name: 'Create Task' }).click()

    // Task should appear in the main content
    const main = page.locator('main')
    await expect(main.getByText('My first test task')).toBeVisible()
  })
})
