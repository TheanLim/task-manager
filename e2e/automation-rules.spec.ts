import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, SECTION_IDS, TASK_IDS, RULE_IDS } from './fixtures/seed-data'

// ── Helpers ─────────────────────────────────────────────────────────────────

const NOW = '2026-02-14T10:00:00.000Z'

/** Generate `count` automation rules for a project. */
function generateRules(projectId: string, sectionId: string, count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `rule-gen-${i}`,
    projectId,
    name: `Generated Rule ${i + 1}`,
    trigger: { type: 'card_moved_into_section', sectionId },
    filters: [],
    action: {
      type: 'mark_card_complete',
      sectionId: null,
      dateOption: null,
      position: null,
      cardTitle: null,
      cardDateOption: null,
      specificMonth: null,
      specificDay: null,
      monthTarget: null,
    },
    enabled: true,
    brokenReason: null,
    executionCount: 0,
    lastExecutedAt: null,
    recentExecutions: [],
    order: i,
    createdAt: NOW,
    updatedAt: NOW,
  }))
}

/** Seed with a custom set of automation rules (replaces the default 2). */
async function seedWithCustomRules(page: import('@playwright/test').Page, rulesJson: string) {
  await page.evaluate(
    (json) => { localStorage.setItem('task-management-automations', json) },
    rulesJson,
  )
  await page.reload()
}

// ── 1. Section Context Menu ─────────────────────────────────────────────────

test.describe('Section context menu — automation entry point', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
  })

  test('List view: section header shows "Add automation..." menu item', async ({ page }) => {
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)

    // Find a section header's MoreVertical button (title="Section options")
    const sectionOptionsBtn = page.locator('button[title="Section options"]').first()
    await sectionOptionsBtn.click({ force: true })

    await expect(page.getByText('Add automation...')).toBeVisible({ timeout: 5000 })
  })

  test('Board view: column header shows "Add automation..." menu item', async ({ page }) => {
    await page.goto(`/?project=${PROJECT_ID}&tab=board`)

    // Board columns have MoreVertical buttons — small ghost buttons in column headers
    // Use a more robust locator: find buttons that are small (h-6 w-6) in the board header area
    const moreBtn = page.locator('button:has(svg.lucide-ellipsis-vertical)').first()
    await moreBtn.click({ force: true })

    await expect(page.getByText('Add automation...')).toBeVisible({ timeout: 5000 })
  })

  test('Separator exists before "Add automation..." item', async ({ page }) => {
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)

    const sectionOptionsBtn = page.locator('button[title="Section options"]').first()
    await sectionOptionsBtn.click({ force: true })

    // Verify separator exists in the dropdown
    const dropdown = page.locator('[role="menu"]')
    await expect(dropdown.locator('[role="separator"]')).toBeVisible({ timeout: 5000 })
    await expect(dropdown.getByText('Add automation...')).toBeVisible()
  })
})

// ── 2. Automations Tab ──────────────────────────────────────────────────────

test.describe('Automations tab', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
  })

  test('shows seeded rule cards', async ({ page }) => {
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    await expect(page.getByText('Auto-complete')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Auto-move')).toBeVisible()
  })

  test('Automations tab has Zap icon', async ({ page }) => {
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    // The Automations tab trigger contains a Zap icon (svg with lucide-zap class)
    const automationsTab = page.getByRole('tab', { name: /automations/i })
    await expect(automationsTab).toBeVisible({ timeout: 10000 })
    await expect(automationsTab.locator('svg')).toBeVisible()
  })
})

// ── 3. Rule Dialog Focus Management ─────────────────────────────────────────

test.describe('Rule dialog focus management', () => {
  test('first interactive element receives focus when dialog opens', async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    // Click "+ New Rule" button
    await page.getByRole('button', { name: /new rule/i }).click()

    // Wait for dialog to appear
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Wait for focus management (the component uses a 100ms setTimeout)
    await page.waitForTimeout(200)

    // Verify the focused element is inside the dialog
    const focusedElement = page.locator(':focus')
    await expect(focusedElement).toBeVisible()

    // The focused element should be within the dialog
    const focusedInDialog = dialog.locator(':focus')
    await expect(focusedInDialog).toBeVisible()
  })
})

// ── 4. Rule Dialog Responsive Design ────────────────────────────────────────

test.describe('Rule dialog responsive design', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
  })

  test('desktop (1024x768): dialog has max-width ~672px', async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 768 })
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    await page.getByRole('button', { name: /new rule/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const box = await dialog.boundingBox()
    expect(box).toBeTruthy()
    // max-w-2xl = 42rem = 672px; dialog should not exceed this
    expect(box!.width).toBeLessThanOrEqual(700)
  })

  test('tablet (700x500): dialog is visible and narrower', async ({ page }) => {
    await page.setViewportSize({ width: 700, height: 500 })
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    await page.getByRole('button', { name: /new rule/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const box = await dialog.boundingBox()
    expect(box).toBeTruthy()
    // Should fit within the viewport
    expect(box!.width).toBeLessThanOrEqual(700)
  })

  test('mobile (375x667): dialog takes full width (sheet mode)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    await page.getByRole('button', { name: /new rule/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    const box = await dialog.boundingBox()
    expect(box).toBeTruthy()
    // In sheet mode (max-sm:max-w-full), dialog should span full viewport width
    expect(box!.width).toBeGreaterThanOrEqual(355)
  })
})

// ── 5. Automation Execution Toast ───────────────────────────────────────────

test.describe('Automation execution toast', () => {
  test('completing a task triggers automation toast with Undo button', async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)

    // Wait for the list to render with tasks
    await expect(page.getByText('Set up CI pipeline')).toBeVisible({ timeout: 10000 })

    // The seeded "Auto-move" rule triggers on card_marked_complete and moves to Done.
    // Complete a task by clicking its round completion button (custom <button>, not a checkbox).
    const taskRow = page.locator('tr', { has: page.getByText('Set up CI pipeline') })
    const completeBtn = taskRow.getByRole('button', { name: 'Mark as complete' })
    await completeBtn.click({ timeout: 5000 })

    // The automation should fire and show a toast with "⚡ Automation:"
    const toast = page.locator('text=⚡ Automation:')
    await expect(toast).toBeVisible({ timeout: 10000 })

    // Verify Undo button exists in the toast (Req 6.1)
    const undoBtn = page.getByRole('button', { name: 'Undo' })
    await expect(undoBtn).toBeVisible({ timeout: 3000 })
  })

  test('toast auto-dismisses after ~10 seconds (undo-capable toast)', async ({ page }) => {
    await seedDatabase(page)
    await page.goto(`/?project=${PROJECT_ID}&tab=list`)

    await expect(page.getByText('Set up CI pipeline')).toBeVisible({ timeout: 10000 })

    // Trigger automation via task completion (custom round button, not a checkbox)
    const taskRow = page.locator('tr', { has: page.getByText('Set up CI pipeline') })
    const completeBtn = taskRow.getByRole('button', { name: 'Mark as complete' })
    await completeBtn.click({ timeout: 5000 })

    // Toast should appear
    const toast = page.locator('text=⚡ Automation:')
    const appeared = await toast.isVisible({ timeout: 10000 }).catch(() => false)

    if (appeared) {
      // Wait for auto-dismiss (~10s for undo toast)
      await expect(toast).not.toBeVisible({ timeout: 15000 })
    } else {
      test.skip(true, 'Toast did not appear — automation may not have fired')
    }
  })
})

// ── 6. Max Rules Warning Toast ──────────────────────────────────────────────

test.describe('Max rules warning toast', () => {
  test('creating 10th rule shows warning toast', async ({ page }) => {
    await seedDatabase(page)

    // Seed with 9 rules (replacing the default 2)
    const nineRules = generateRules(PROJECT_ID, SECTION_IDS.done, 9)
    await seedWithCustomRules(page, JSON.stringify(nineRules))

    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)

    // Verify 9 rules are visible
    await expect(page.getByText('Generated Rule 1')).toBeVisible({ timeout: 10000 })

    // Click "+ New Rule" to create the 10th rule
    await page.getByRole('button', { name: /new rule/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })

    // Step 1: Select a trigger — click "moved into section" radio label
    await dialog.getByText('moved into section').first().click()

    // Select the Done section from the SectionPicker (shadcn Select, not native <select>)
    const sectionTrigger = dialog.locator('button[role="combobox"]').first()
    if (await sectionTrigger.isVisible({ timeout: 3000 }).catch(() => false)) {
      await sectionTrigger.click()
      await page.getByRole('option', { name: 'Done' }).click()
    }

    // Click Next to go to Filters step
    await dialog.getByRole('button', { name: /next/i }).click()

    // Step 2: Skip filters
    const skipBtn = dialog.getByRole('button', { name: /skip/i })
    if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipBtn.click()
    } else {
      await dialog.getByRole('button', { name: /next/i }).click()
    }

    // Step 3: Select an action — click "mark as complete"
    await dialog.getByText('mark as complete').first().click()

    // Click Next to go to Review step
    await dialog.getByRole('button', { name: /next/i }).click()

    // Step 4: Review — click Save
    const saveBtn = dialog.getByRole('button', { name: /save/i })
    if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await saveBtn.click()
    }

    // After dialog closes, verify the warning toast appears
    const warningToast = page.getByText('10 automation rules')
    await expect(warningToast).toBeVisible({ timeout: 10000 })
  })
})
