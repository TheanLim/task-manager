import { test, expect } from '@playwright/test'

test.describe('App Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('renders the main layout with header and sidebar', async ({ page }) => {
    // Header should be visible
    const header = page.locator('header')
    await expect(header).toBeVisible()

    // Sidebar toggle button should exist in header
    const sidebarToggle = header.getByRole('button')
    await expect(sidebarToggle.first()).toBeVisible()

    // Sidebar should be visible by default
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Main content area should exist
    const main = page.locator('main')
    await expect(main).toBeVisible()
  })

  test('sidebar can be toggled', async ({ page }) => {
    const sidebar = page.locator('aside')
    await expect(sidebar).toBeVisible()

    // Click the sidebar toggle (first button in header)
    const toggleBtn = page.locator('header').getByRole('button').first()
    await toggleBtn.click()

    // Sidebar should be hidden
    await expect(sidebar).not.toBeVisible()

    // Toggle back
    await toggleBtn.click()
    await expect(sidebar).toBeVisible()
  })

  test('header contains theme toggle and action buttons', async ({ page }) => {
    const header = page.locator('header')

    // Theme toggle should be in the header
    // It uses a sun/moon icon button
    const headerButtons = header.getByRole('button')
    await expect(headerButtons.nth(1)).toBeVisible() // At least sidebar toggle + theme toggle
  })

  test('sidebar contains project list and new project button', async ({ page }) => {
    const sidebar = page.locator('aside')

    // Projects heading should be visible
    await expect(sidebar.getByRole('heading', { name: 'Projects' })).toBeVisible()

    // "All Tasks" link should be visible
    await expect(sidebar.getByText('All Tasks')).toBeVisible()

    // When no projects exist, "Create Project" button should be visible
    await expect(sidebar.getByRole('button', { name: /create project/i })).toBeVisible()
  })
})
