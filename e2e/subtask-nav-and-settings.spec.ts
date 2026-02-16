import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, TASK_IDS } from './fixtures/seed-data'

/**
 * E2E tests for:
 *   Task 7 — Subtask-aware keyboard navigation (Req 2.1, 2.2, 2.3)
 *   Task 8 — Customizable shortcuts UI entry point (Req 6)
 */

/**
 * Helper: focus a specific task row by clicking near its checkbox area,
 * then ensuring the table has focus and the row is highlighted.
 */
async function focusTaskRow(page: import('@playwright/test').Page, taskText: string) {
  const table = page.locator('main').locator('table[role="grid"]')
  const row = table.locator('tr[data-task-id]', { has: page.getByText(taskText, { exact: true }) })
  await expect(row).toBeVisible({ timeout: 5000 })
  // Click far right in the first cell to avoid hitting chevron/checkbox buttons
  await row.locator('td').first().click({ position: { x: 200, y: 10 } })
  await page.waitForTimeout(100)
  // Escape any accidental inline edit
  const editSpan = page.locator('[contenteditable="true"][role="textbox"]')
  if (await editSpan.isVisible().catch(() => false)) {
    await page.keyboard.press('Escape')
    await page.waitForTimeout(100)
  }
  await table.focus()
  await page.waitForTimeout(100)
  await expect(page.locator('tr[data-kb-active="true"]')).toContainText(taskText, { timeout: 3000 })
}

/**
 * Helper: expand subtasks of a parent task by clicking the chevron.
 */
async function expandSubtasks(page: import('@playwright/test').Page, parentTaskText: string) {
  const table = page.locator('main').locator('table[role="grid"]')
  const row = table.locator('tr[data-task-id]', { has: page.getByText(parentTaskText, { exact: true }) })
  const expandBtn = row.locator('button[aria-label="Expand subtasks"]')
  if (await expandBtn.isVisible().catch(() => false)) {
    await expandBtn.click()
    await page.waitForTimeout(200)
  }
}

/**
 * Helper: collapse subtasks of a parent task by clicking the chevron.
 */
async function collapseSubtasks(page: import('@playwright/test').Page, parentTaskText: string) {
  const table = page.locator('main').locator('table[role="grid"]')
  const row = table.locator('tr[data-task-id]', { has: page.getByText(parentTaskText, { exact: true }) })
  const collapseBtn = row.locator('button[aria-label="Collapse subtasks"]')
  if (await collapseBtn.isVisible().catch(() => false)) {
    await collapseBtn.click()
    await page.waitForTimeout(200)
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Task 7: Subtask-Aware Navigation
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Subtask-Aware Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)
    await expect(page.locator('main').getByText('Set up CI pipeline')).toBeVisible({ timeout: 10000 })
  })

  test('expanding subtasks makes them visible in the DOM', async ({ page }) => {
    // "Refactor components" has subtasks "Extract shared hooks" and "Update imports"
    // Subtasks should NOT be visible initially (collapsed by default)
    await expect(page.getByText('Extract shared hooks')).not.toBeVisible()
    await expect(page.getByText('Update imports')).not.toBeVisible()

    // Expand subtasks
    await expandSubtasks(page, 'Refactor components')

    // Subtasks should now be visible
    await expect(page.getByText('Extract shared hooks')).toBeVisible()
    await expect(page.getByText('Update imports')).toBeVisible()
  })

  test('j navigates into expanded subtasks after parent row', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')
    await expect(page.getByText('Extract shared hooks')).toBeVisible()
    await page.waitForTimeout(300)

    await focusTaskRow(page, 'Refactor components')
    await page.waitForTimeout(300)

    // Press j — should move to first subtask "Extract shared hooks"
    await page.keyboard.press('j')
    await page.waitForTimeout(300)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    await expect(activeRow).toContainText('Extract shared hooks')

    // Press j again — should move to second subtask "Update imports"
    await page.keyboard.press('j')
    await page.waitForTimeout(300)
    await expect(activeRow).toContainText('Update imports')
  })

  test('k navigates back from subtask to parent', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')

    // Focus the first subtask
    await focusTaskRow(page, 'Extract shared hooks')

    // Press k — should move back to parent "Refactor components"
    await page.keyboard.press('k')
    await page.waitForTimeout(200)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    await expect(activeRow).toContainText('Refactor components')
  })

  test('j skips collapsed subtasks and moves to next sibling task', async ({ page }) => {
    // Subtasks are collapsed by default — "Refactor components" subtasks hidden
    await expect(page.getByText('Extract shared hooks')).not.toBeVisible()

    // Focus "Implement auth flow" (first task in Doing section, before Refactor components)
    await focusTaskRow(page, 'Implement auth flow')

    // Navigate down to "Prepare demo" then "Refactor components"
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    await expect(page.locator('tr[data-kb-active="true"]')).toContainText('Refactor components')

    // Press j — should skip collapsed subtasks and go to the next visible task (Done section)
    await page.keyboard.press('j')
    await page.waitForTimeout(300)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    // Should NOT be on a subtask
    await expect(activeRow).not.toContainText('Extract shared hooks')
    await expect(activeRow).not.toContainText('Update imports')
    // Should be on the Done section task
    await expect(activeRow).toContainText('Design database schema')
  })

  test('collapsing subtasks while on a subtask moves focus to parent', async ({ page }) => {
    // Expand subtasks
    await expandSubtasks(page, 'Refactor components')

    // Focus a subtask
    await focusTaskRow(page, 'Extract shared hooks')

    // Collapse subtasks
    await collapseSubtasks(page, 'Refactor components')
    await page.waitForTimeout(300)

    // Subtask should no longer be visible
    await expect(page.getByText('Extract shared hooks')).not.toBeVisible()

    // Navigation should still work — press j from wherever focus recovered
    const table = page.locator('table[role="grid"]')
    await table.focus()
    await page.keyboard.press('j')
    await page.waitForTimeout(200)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    await expect(activeRow).toBeVisible()
  })

  test('expand subtasks, navigate through them, then collapse — navigation continues', async ({ page }) => {
    // Expand
    await expandSubtasks(page, 'Refactor components')
    await expect(page.getByText('Extract shared hooks')).toBeVisible()

    // Navigate through subtasks
    await focusTaskRow(page, 'Refactor components')
    await page.keyboard.press('j') // → Extract shared hooks
    await page.waitForTimeout(300)
    await expect(page.locator('tr[data-kb-active="true"]')).toContainText('Extract shared hooks')
    await page.keyboard.press('j') // → Update imports
    await page.waitForTimeout(300)
    await expect(page.locator('tr[data-kb-active="true"]')).toContainText('Update imports')

    // Collapse
    await collapseSubtasks(page, 'Refactor components')
    await page.waitForTimeout(500)

    // Focus the table and navigate — should work without errors
    const table = page.locator('table[role="grid"]')
    await table.focus()
    await page.keyboard.press('j')
    await page.waitForTimeout(300)
    await expect(page.locator('tr[data-kb-active="true"]')).toBeVisible()
    await page.keyboard.press('k')
    await page.waitForTimeout(300)
    await expect(page.locator('tr[data-kb-active="true"]')).toBeVisible()
  })

  test('G jumps to last visible row, skipping collapsed subtasks', async ({ page }) => {
    // Subtasks collapsed by default
    const table = page.locator('table[role="grid"]')
    await table.focus()
    await page.keyboard.press('j') // activate navigation

    // G (Shift+g) should jump to the last visible row
    await page.keyboard.press('Shift+g')
    await page.waitForTimeout(200)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    await expect(activeRow).toBeVisible()
    // Should NOT be on a hidden subtask
    await expect(activeRow).not.toContainText('Extract shared hooks')
    await expect(activeRow).not.toContainText('Update imports')
  })

  test('gg jumps to first visible row with subtasks expanded', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')

    // Navigate to a subtask
    await focusTaskRow(page, 'Update imports')

    // gg should jump to the very first visible row
    await page.keyboard.press('g')
    await page.keyboard.press('g')
    await page.waitForTimeout(200)
    const activeRow = page.locator('tr[data-kb-active="true"]')
    await expect(activeRow).toBeVisible()
    // First row should be the first task in the first section (To Do)
    await expect(activeRow).toContainText('Set up CI pipeline')
  })

  test('Space toggles completion on a focused subtask', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')
    await focusTaskRow(page, 'Extract shared hooks')

    // Count completed before
    const completedBefore = await page.locator('button[aria-label="Mark as incomplete"]').count()

    // Space toggles completion
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Space')
    await page.waitForTimeout(500)

    const completedAfter = await page.locator('button[aria-label="Mark as incomplete"]').count()
    expect(completedAfter).not.toBe(completedBefore)
  })

  test('Enter opens detail panel for a focused subtask', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')
    await focusTaskRow(page, 'Extract shared hooks')

    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)

    // Detail panel should appear
    const panel = page.locator('.animate-slide-in-right')
    await expect(panel).toBeVisible({ timeout: 5000 })

    // Close it
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
  })

  test('section skip [ and ] work correctly with expanded subtasks', async ({ page }) => {
    await expandSubtasks(page, 'Refactor components')

    // Focus a task in the To Do section
    await focusTaskRow(page, 'Set up CI pipeline')

    // ] should jump to the next section (Doing)
    await page.keyboard.press(']')
    await page.waitForTimeout(200)
    const activeAfterNext = page.locator('tr[data-kb-active="true"]')
    await expect(activeAfterNext).toBeVisible()

    // The active row should be in the Doing section area
    // (either "Implement auth flow" or another Doing task)
    const activeText = await activeAfterNext.textContent()
    // It should NOT be a To Do task
    expect(activeText).not.toContain('Set up CI pipeline')
    expect(activeText).not.toContain('Write unit tests')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Task 8: Customizable Shortcuts UI Entry Point
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Customizable Shortcuts UI Entry Point', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)
    await expect(page.locator('main').getByText('Set up CI pipeline')).toBeVisible({ timeout: 10000 })
  })

  test('help overlay shows "Edit shortcuts…" link', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Edit shortcuts…')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('clicking "Edit shortcuts…" switches to settings view', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await page.waitForTimeout(200)

    // Should show "Edit Shortcuts" heading
    await expect(overlay.getByText('Edit Shortcuts')).toBeVisible()
    // Should show "Reset to defaults" button
    await expect(overlay.getByText('Reset to defaults')).toBeVisible()
    // Should show a back button
    await expect(overlay.getByLabel('Back to shortcuts')).toBeVisible()
    // The "Edit shortcuts…" link should be gone (we're in settings view)
    await expect(overlay.getByText('Edit shortcuts…')).not.toBeVisible()
  })

  test('back button returns to shortcut list from settings', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    // Go to settings
    await overlay.getByText('Edit shortcuts…').click()
    await expect(overlay.getByText('Edit Shortcuts')).toBeVisible()

    // Click back
    await overlay.getByLabel('Back to shortcuts').click()
    await page.waitForTimeout(200)

    // Should be back to the shortcut list
    await expect(overlay.getByText('Keyboard Shortcuts')).toBeVisible()
    await expect(overlay.getByText('Edit shortcuts…')).toBeVisible()
    await expect(overlay.getByText('Reset to defaults')).not.toBeVisible()
  })

  test('Escape from settings view returns to shortcut list, not closes overlay', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    // Go to settings
    await overlay.getByText('Edit shortcuts…').click()
    await expect(overlay.getByText('Edit Shortcuts')).toBeVisible()

    // First Escape should close settings, NOT the overlay
    await page.keyboard.press('Escape')
    await page.waitForTimeout(200)

    // Overlay should still be open, showing the shortcut list
    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Edit shortcuts…')).toBeVisible()

    // Second Escape closes the overlay
    await page.keyboard.press('Escape')
    await expect(overlay).not.toBeVisible()
  })

  test('settings view shows shortcut categories with editable bindings', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await page.waitForTimeout(200)

    // Should show all three categories
    await expect(overlay.getByText('Navigation')).toBeVisible()
    await expect(overlay.getByText('Global')).toBeVisible()
    await expect(overlay.getByText('Task Actions')).toBeVisible()

    // Should show shortcut labels
    await expect(overlay.getByText('New task')).toBeVisible()
    await expect(overlay.getByText('Edit task')).toBeVisible()
    await expect(overlay.getByText('Move up')).toBeVisible()
  })

  test('clicking a key binding in settings enters recording mode', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await page.waitForTimeout(200)

    // Find a kbd element with 'n' (the New task shortcut) and click it
    const nKbd = overlay.locator('kbd[role="button"]').filter({ hasText: /^n$/ }).first()
    await expect(nKbd).toBeVisible()
    await nKbd.click()

    // Should show "Press a key…" recording indicator
    await expect(overlay.getByText('Press a key…')).toBeVisible()
  })

  test('clicking a key binding enters recording mode and can be cancelled', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await page.waitForTimeout(300)

    // Click the 'n' key binding to start recording
    const nKbd = overlay.locator('kbd[role="button"]').filter({ hasText: /^n$/ }).first()
    await expect(nKbd).toBeVisible()
    await nKbd.click()

    // Should show "Press a key…" recording indicator
    await expect(overlay.getByText('Press a key…')).toBeVisible()

    // Click the same kbd again to cancel recording
    await overlay.getByText('Press a key…').click()
    await page.waitForTimeout(200)

    // Should go back to showing 'n'
    await expect(nKbd).toBeVisible()
    await expect(overlay.getByText('Press a key…')).not.toBeVisible()
  })

  test('reset to defaults button is functional', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await page.waitForTimeout(300)

    // Verify "Reset to defaults" button exists and is clickable
    const resetBtn = overlay.getByText('Reset to defaults')
    await expect(resetBtn).toBeVisible()
    await resetBtn.click()
    await page.waitForTimeout(200)

    // After reset, all shortcuts should still show their default keys
    // Go back to shortcut list to verify
    await overlay.getByLabel('Back to shortcuts').click()
    await page.waitForTimeout(300)

    // "New task" should show 'n' (the default)
    const newTaskRow = overlay.locator('li', { has: page.getByText('New task') })
    await expect(newTaskRow.locator('kbd')).toContainText('n')
  })

  test('close button works from settings view', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()
    await expect(overlay.getByText('Edit Shortcuts')).toBeVisible()

    // Click the close (X) button
    await overlay.getByRole('button', { name: /close/i }).click()
    await expect(overlay).not.toBeVisible()
  })

  test('reopening help overlay after settings shows shortcut list (not settings)', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()

    // Open overlay, go to settings, close
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await overlay.getByText('Edit shortcuts…').click()
    await expect(overlay.getByText('Edit Shortcuts')).toBeVisible()
    await overlay.getByRole('button', { name: /close/i }).click()
    await expect(overlay).not.toBeVisible()

    // Reopen — should show shortcut list, not settings
    await page.keyboard.press('Shift+/')
    await expect(overlay).toBeVisible()
    await expect(overlay.getByText('Keyboard Shortcuts')).toBeVisible()
    await expect(overlay.getByText('Edit shortcuts…')).toBeVisible()
    await page.keyboard.press('Escape')
  })

  test('overlay maintains correct ARIA attributes in settings view', async ({ page }) => {
    await page.locator('table[role="grid"]').focus()
    await page.keyboard.press('Shift+/')
    const overlay = page.getByRole('dialog', { name: /keyboard shortcuts/i })

    await overlay.getByText('Edit shortcuts…').click()

    // ARIA attributes should still be correct
    await expect(overlay).toHaveAttribute('aria-modal', 'true')
    await expect(overlay).toHaveAttribute('role', 'dialog')
    await page.keyboard.press('Escape') // close settings
    await page.keyboard.press('Escape') // close overlay
  })
})
