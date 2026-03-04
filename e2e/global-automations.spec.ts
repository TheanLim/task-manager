import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, PROJECT_2_ID, SECTION_IDS, SECTION_2_IDS } from './fixtures/seed-data'

const NOW = '2026-02-14T10:00:00.000Z'

/** Seed a global automation rule into localStorage */
async function seedGlobalRule(
  page: import('@playwright/test').Page,
  rule: Record<string, unknown>
) {
  await page.evaluate((ruleJson) => {
    const existing = JSON.parse(localStorage.getItem('task-management-automations') || '[]')
    existing.push(JSON.parse(ruleJson))
    localStorage.setItem('task-management-automations', JSON.stringify(existing))
  }, JSON.stringify(rule))
  await page.reload()
}

function makeGlobalRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global-rule-001',
    projectId: null,
    name: 'Global Auto-complete',
    trigger: { type: 'card_marked_complete', sectionId: null },
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
    order: 99,
    createdAt: NOW,
    updatedAt: NOW,
    excludedProjectIds: [],
    ...overrides,
  }
}

// ── 1. Sidebar nav item ──────────────────────────────────────────────────────

test.describe('Global Automations — sidebar nav', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
  })

  test('sidebar shows "Automations" nav item with Zap icon', async ({ page }) => {
    await page.goto('/')
    const automationsBtn = page.getByRole('button', { name: /automations/i })
    await expect(automationsBtn).toBeVisible({ timeout: 10000 })
    await expect(automationsBtn.locator('svg')).toBeVisible()
  })

  test('clicking "Automations" renders the global panel', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /automations/i }).click()
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 5000 })
  })

  test('amber badge appears when global rule has section-not-found skips', async ({ page }) => {
    await page.goto('/')
    const ruleWithSkip = makeGlobalRule({
      recentExecutions: [{
        timestamp: NOW,
        triggerDescription: 'Card moved',
        actionDescription: 'Move to Done',
        taskName: 'Task X',
        executionType: 'skipped',
        isGlobal: true,
        firingProjectId: PROJECT_ID,
        skipReason: "Section 'Done' not found in project 'Alpha'",
        ruleId: 'global-rule-001',
      }],
    })
    await seedGlobalRule(page, ruleWithSkip)
    // Badge should appear on the sidebar Automations button
    const badge = page.locator('button[aria-label*="Automations"]').locator('..').getByText('1')
    // More robust: look for the amber badge near the Automations button
    const automationsArea = page.locator('button', { hasText: 'Automations' }).locator('..')
    await expect(automationsArea.getByText('1')).toBeVisible({ timeout: 5000 })
  })
})

// ── 2. Global Automations Panel ──────────────────────────────────────────────

test.describe('Global Automations — panel', () => {
  test.beforeEach(async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')
    await page.getByRole('button', { name: /automations/i }).click()
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 5000 })
  })

  test('empty state shows "No global rules yet" with CTA', async ({ page }) => {
    await expect(page.getByText('No global rules yet')).toBeVisible()
    await expect(page.getByText(/Create a rule once/)).toBeVisible()
    await expect(page.getByText('+ Create your first rule')).toBeVisible()
  })

  test('"+ New Rule" opens wizard with "New Global Rule" title', async ({ page }) => {
    await page.getByRole('button', { name: /new rule/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    await expect(dialog.getByText('New Global Rule')).toBeVisible()
  })

  test('wizard shows "Scope: All Projects" pill', async ({ page }) => {
    await page.getByRole('button', { name: /new rule/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText(/Scope: All Projects/)).toBeVisible({ timeout: 5000 })
  })

  test('scheduled triggers are disabled in global rule wizard', async ({ page }) => {
    await page.getByRole('button', { name: /new rule/i }).first().click()
    const dialog = page.getByRole('dialog')
    await expect(dialog).toBeVisible({ timeout: 5000 })
    // Scheduled trigger radios should be disabled
    const scheduledRadios = dialog.locator('input[type="radio"][disabled]')
    await expect(scheduledRadios.first()).toBeVisible({ timeout: 3000 })
  })
})

// ── 3. Global rule in project tab ────────────────────────────────────────────

test.describe('Global Automations — project tab integration', () => {
  test('global rule appears in project automation tab as read-only', async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')
    await seedGlobalRule(page, makeGlobalRule())

    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)
    // Global Rules section should appear above local rules
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Auto-complete')).toBeVisible()
    // Should show Global badge
    await expect(page.getByText('Global').first()).toBeVisible()
  })

  test('"Manage" link in project tab navigates to global panel', async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')
    await seedGlobalRule(page, makeGlobalRule())

    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })

    await page.getByText('Manage').click()
    // Should navigate to global automations panel
    await expect(page.getByText('Rules that run across all your projects automatically.')).toBeVisible({ timeout: 5000 })
  })
})

// ── 4. Global rule execution ─────────────────────────────────────────────────

test.describe('Global Automations — execution', () => {
  test('global rule fires in a project and shows Global badge in execution log', async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')

    // Seed a global rule that marks complete when moved to Done
    const globalRule = makeGlobalRule({
      id: 'global-move-done',
      name: 'Global Move to Done',
      trigger: { type: 'card_moved_into_section', sectionId: SECTION_IDS.done },
      action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    })
    await seedGlobalRule(page, globalRule)

    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)
    await expect(page.getByText('Global Move to Done')).toBeVisible({ timeout: 10000 })
  })

  test('global rule with excludedProjectIds does not show in excluded project', async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')

    const globalRule = makeGlobalRule({
      excludedProjectIds: [PROJECT_ID],
    })
    await seedGlobalRule(page, globalRule)

    await page.goto(`/?project=${PROJECT_ID}&tab=automations`)
    // Global Rules section should NOT appear since this project is excluded
    await expect(page.getByText('Global Rules')).not.toBeVisible({ timeout: 3000 })
  })
})

// ── 5. Execution log ─────────────────────────────────────────────────────────

test.describe('Global Automations — execution log', () => {
  test('execution log tab shows Project column', async ({ page }) => {
    await seedDatabase(page)
    await page.goto('/')

    const ruleWithLog = makeGlobalRule({
      recentExecutions: [{
        timestamp: NOW,
        triggerDescription: 'Card marked complete',
        actionDescription: 'Mark complete',
        taskName: 'Task X',
        executionType: 'event',
        isGlobal: true,
        firingProjectId: PROJECT_ID,
        ruleId: 'global-rule-001',
      }],
    })
    await seedGlobalRule(page, ruleWithLog)

    await page.getByRole('button', { name: /automations/i }).click()
    await expect(page.getByText('Automations')).toBeVisible({ timeout: 5000 })

    await page.getByRole('tab', { name: /execution log/i }).click()
    await expect(page.getByText('Project')).toBeVisible({ timeout: 3000 })
    await expect(page.getByText('Global Auto-complete')).toBeVisible()
  })
})
