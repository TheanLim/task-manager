import { test, expect } from '@playwright/test'

test.describe('Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('shows "Create Project" button in sidebar', async ({ page }) => {
    const sidebar = page.locator('aside')
    const createProjectBtn = sidebar.getByRole('button', { name: /create project/i })
    await expect(createProjectBtn).toBeVisible()
  })

  test('can open the new project dialog', async ({ page }) => {
    const sidebar = page.locator('aside')
    await sidebar.getByRole('button', { name: /create project/i }).click()

    // Dialog should appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible()

    // Dialog should have a name input
    await expect(dialog.getByLabel(/name/i)).toBeVisible()

    // Dialog should have save/create and cancel buttons
    await expect(dialog.getByRole('button', { name: /create|save/i })).toBeVisible()
    await expect(dialog.getByRole('button', { name: /cancel/i })).toBeVisible()
  })

  test('can create a new project', async ({ page }) => {
    // Open dialog
    const sidebar = page.locator('aside')
    await sidebar.getByRole('button', { name: /create project/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/name/i).fill('Test Project')

    // Submit
    await dialog.getByRole('button', { name: /create|save/i }).click()

    // Dialog should close
    await expect(dialog).not.toBeVisible()

    // Project should appear in sidebar
    await expect(sidebar.getByText('Test Project')).toBeVisible()
  })

  test('project tabs are visible when a project is selected', async ({ page }) => {
    // Create a project first
    const sidebar = page.locator('aside')
    await sidebar.getByRole('button', { name: /create project/i }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel(/name/i).fill('Tab Test Project')
    await dialog.getByRole('button', { name: /create|save/i }).click()

    // Click the project in sidebar
    await sidebar.getByText('Tab Test Project').click()

    // Main content should show project tabs
    const main = page.locator('main')
    await expect(main.getByRole('tab', { name: /list/i })).toBeVisible()
    await expect(main.getByRole('tab', { name: /board/i })).toBeVisible()
    await expect(main.getByRole('tab', { name: /calendar/i })).toBeVisible()
  })
})
