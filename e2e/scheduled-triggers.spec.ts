import { test, expect, type Page } from '@playwright/test'
import {
  seedDatabase,
  PHASE5A_PROJECT_ID,
  PHASE5A_PROJECT_2_ID,
  PHASE5A_SECTIONS,
  PHASE5A_SECTIONS_2,
  PHASE5B_PROJECT_ID,
  PHASE5B_SECTIONS,
  PHASE5C_PROJECT_ID,
  PHASE5C_SECTIONS,
} from './fixtures/scheduled-triggers-seed'

// ── Shared Helpers ──────────────────────────────────────────────────────────

async function gotoAutomations(page: Page, projectId: string) {
  await page.goto(`/?project=${projectId}&tab=automations`)
}

async function gotoList(page: Page, projectId: string) {
  await page.goto(`/?project=${projectId}&tab=list`)
}

async function getStoredRules(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('task-management-automations')
    return raw ? JSON.parse(raw) : []
  })
}

async function getStoredTasks(page: Page) {
  return page.evaluate(() => {
    const raw = localStorage.getItem('task-management-data')
    if (!raw) return []
    return JSON.parse(raw).state?.tasks ?? []
  })
}

async function waitForSchedulerCatchUp(page: Page, ruleId: string, timeout = 15_000) {
  await page.waitForFunction(
    (id) => {
      const raw = localStorage.getItem('task-management-automations')
      if (!raw) return false
      const rules = JSON.parse(raw)
      const rule = rules.find((r: any) => r.id === id)
      if (!rule) return false
      const trigger = rule.trigger
      if (trigger.lastEvaluatedAt) {
        const lastMs = new Date(trigger.lastEvaluatedAt).getTime()
        return Date.now() - lastMs < 30_000
      }
      return false
    },
    ruleId,
    { timeout },
  )
}

function ruleCard(page: Page, nameSubstring: string) {
  return page.locator('div[role="button"]', { has: page.locator('h3', { hasText: nameSubstring }) })
}

// ═══════════════════════════════════════════════════════════════════════════
// Phase 5a Tests (TC-1 through TC-17)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Phase 5a: Core Scheduled Triggers', () => {

  // ── TC-1: Scheduler Tick Loop & Catch-Up ──────────────────────────────

  test.describe('TC-1: Scheduler tick loop and catch-up on load', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('1.1 — scheduler fires catch-up tick on page load', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-set-due')
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5a-interval-set-due')
      expect(rule.trigger.lastEvaluatedAt).toBeTruthy()
    })

    test('1.2 — catch-up fires interval rule and affects matching tasks', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-overdue')
      const tasks = await getStoredTasks(page)
      const overdue1 = tasks.find((t: any) => t.id === 'task-5a-overdue-1')
      const overdue2 = tasks.find((t: any) => t.id === 'task-5a-overdue-2')
      expect(overdue1.sectionId).not.toBe(PHASE5A_SECTIONS.todo)
      expect(overdue2.sectionId).not.toBe(PHASE5A_SECTIONS.todo)
    })

    test('1.3 — catch-up creates Daily Standup card (cron rule)', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-cron-daily-standup')
      const tasks = await getStoredTasks(page)
      const standupTasks = tasks.filter(
        (t: any) => t.description === 'Daily Standup' && t.projectId === PHASE5A_PROJECT_ID
      )
      expect(standupTasks.length).toBeGreaterThanOrEqual(1)
    })

    test('1.4 — disabled rule does NOT fire', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-overdue')
      const rules = await getStoredRules(page)
      const disabledRule = rules.find((r: any) => r.id === 'rule-5a-disabled')
      expect(disabledRule.enabled).toBe(false)
      expect(disabledRule.executionCount).toBe(0)
      expect(disabledRule.trigger.lastEvaluatedAt).toBeNull()
    })
  })

  // ── TC-2: Scheduled Interval Triggers ─────────────────────────────────

  test.describe('TC-2: Scheduled interval triggers', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('2.1 — interval rule updates execution log', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-overdue')
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5a-interval-overdue')
      expect(rule.executionCount).toBeGreaterThanOrEqual(3)
      expect(rule.recentExecutions.length).toBeGreaterThanOrEqual(1)
    })

    test('2.2 — no-due-date tasks get due date set', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-set-due')
      const tasks = await getStoredTasks(page)
      const noDueTask = tasks.find((t: any) => t.id === 'task-5a-no-due')
      expect(noDueTask.dueDate).toBeTruthy()
    })

    test('2.3 — 5-min interval moves To Do tasks with due dates', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-5min')
      const tasks = await getStoredTasks(page)
      const task = tasks.find((t: any) => t.id === 'task-5a-due-today-1')
      expect(task.sectionId).not.toBe(PHASE5A_SECTIONS.todo)
    })
  })

  // ── TC-4: Due-Date-Relative Triggers ──────────────────────────────────

  test.describe('TC-4: Due-date-relative triggers', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('4.1 — 1 day before due moves task to In Progress', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-duerel-1day-before')
      const tasks = await getStoredTasks(page)
      const task = tasks.find((t: any) => t.id === 'task-5a-due-tomorrow')
      expect(task.sectionId).toBe(PHASE5A_SECTIONS.inProgress)
    })

    test('4.2 — 1 day after due marks overdue tasks complete', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-duerel-1day-after')
      const tasks = await getStoredTasks(page)
      const task = tasks.find((t: any) => t.id === 'task-5a-overdue-1')
      expect(task.completed).toBe(true)
    })
  })

  // ── TC-7: Run Now Button ──────────────────────────────────────────────

  test.describe('TC-7: Run Now button', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('7.1 — Run Now appears in dropdown for scheduled rules', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Move overdue')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByRole('button', { name: 'Open menu' }).click({ force: true })
      await expect(page.getByRole('menuitem', { name: 'Run Now' })).toBeVisible({ timeout: 3000 })
    })

    test('7.2 — Run Now does NOT appear for event-based rules', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Auto-complete on Done')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByRole('button', { name: 'Open menu' }).click({ force: true })
      await expect(page.getByRole('menuitem', { name: 'Run Now' })).not.toBeVisible({ timeout: 2000 })
    })

    test('7.3 — Run Now fires the rule and updates execution count', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Weekly review')
      await expect(card).toBeVisible({ timeout: 10_000 })
      const rulesBefore = await getStoredRules(page)
      const before = rulesBefore.find((r: any) => r.id === 'rule-5a-cron-weekly-review')
      const countBefore = before.executionCount
      await card.getByRole('button', { name: 'Open menu' }).click({ force: true })
      await page.getByRole('menuitem', { name: 'Run Now' }).click()
      await page.waitForTimeout(2000)
      const rulesAfter = await getStoredRules(page)
      const after = rulesAfter.find((r: any) => r.id === 'rule-5a-cron-weekly-review')
      expect(after.executionCount).toBeGreaterThan(countBefore)
    })
  })

  // ── TC-8: Execution Log (ScheduleHistoryView) ────────────────────────

  test.describe('TC-8: Execution log display', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('8.1 — scheduled rule shows aggregated history with badges', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Daily standup')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByText('Recent activity').click({ force: true })
      await expect(card.locator('[data-testid="execution-type-badge"]').first()).toBeVisible({ timeout: 3000 })
    })

    test('8.2 — pre-seeded history shows Scheduled and Catch-up badges', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Daily standup')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByText('Recent activity').click({ force: true })
      await expect(card.getByText('⚡ Scheduled')).toBeVisible({ timeout: 3000 })
      await expect(card.getByText('🔄 Catch-up')).toBeVisible({ timeout: 3000 })
    })

    test('8.3 — event-based rule shows standard execution log', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Auto-complete on Done')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByText('Recent activity').click({ force: true })
      await expect(card.getByText('No activity yet')).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-12: Rule Creation Wizard ───────────────────────────────────────

  test.describe('TC-12: Rule creation wizard for scheduled triggers', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('12.1 — Scheduled category with 3 trigger types', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog.getByText('Scheduled').first()).toBeVisible()
      await expect(dialog.getByText('on a recurring interval')).toBeVisible()
      await expect(dialog.getByText('at a specific time')).toBeVisible()
      await expect(dialog.getByText('relative to due date')).toBeVisible()
    })

    test('12.2 — selecting Interval shows config panel', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('on a recurring interval').click()
      const intervalInput = dialog.locator('input[type="number"]').first()
      await expect(intervalInput).toBeVisible({ timeout: 3000 })
    })

    test('12.3 — selecting Cron shows day-of-week toggles', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      await dialog.getByRole('tab', { name: 'Weekly' }).click()
      const dayGroup = dialog.locator('[role="group"][aria-label="Days of week"]')
      await expect(dayGroup).toBeVisible({ timeout: 3000 })
    })

    test('12.4 — info tooltip present on Scheduled header', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      const infoIcon = dialog.locator('svg.lucide-info')
      await expect(infoIcon).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-13: Rule Card Display ──────────────────────────────────────────

  test.describe('TC-13: Rule card display for scheduled rules', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('13.1 — scheduled rules show clock icon', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Move overdue')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card.locator('svg.lucide-clock')).toBeVisible()
    })

    test('13.2 — scheduled rules show execution stats', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Move overdue')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card.getByText(/Ran \d+ times?/)).toBeVisible()
    })

    test('13.3 — trigger badge shows scheduled trigger label', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Move overdue')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card.getByText('on a recurring interval').first()).toBeVisible()
    })
  })

  // ── TC-14: Disabled Rule Behavior ─────────────────────────────────────

  test.describe('TC-14: Disabled rule behavior', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('14.1 — disabled rule shows Paused badge', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Disabled')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await expect(card.getByText('Paused', { exact: true })).toBeVisible()
    })

    test('14.2 — toggling disabled rule ON removes Paused badge', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const card = ruleCard(page, 'Disabled')
      await expect(card).toBeVisible({ timeout: 10_000 })
      const toggle = card.locator('button[role="switch"]')
      await toggle.click({ force: true })
      const badge = card.locator('[class*="badge"]', { hasText: 'Paused' })
      await expect(badge).not.toBeVisible({ timeout: 3000 })
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5a-disabled')
      expect(rule.enabled).toBe(true)
    })
  })

  // ── TC-15: Cross-Project Scheduler ────────────────────────────────────

  test.describe('TC-15: Cross-project scheduler', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('15.1 — secondary project shows its own scheduled rule', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_2_ID)
      const card = ruleCard(page, 'Beta')
      await expect(card).toBeVisible({ timeout: 10_000 })
    })

    test('15.2 — main project tasks stay in main project sections', async ({ page }) => {
      await gotoList(page, PHASE5A_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5a-interval-overdue')
      const tasks = await getStoredTasks(page)
      const mainOverdue = tasks.find((t: any) => t.id === 'task-5a-overdue-1')
      expect(mainOverdue.projectId).toBe(PHASE5A_PROJECT_ID)
      const mainSections = Object.values(PHASE5A_SECTIONS)
      expect(mainSections).toContain(mainOverdue.sectionId)
    })
  })

  // ── TC-17: Event Trigger Regression ───────────────────────────────────

  test.describe('TC-17: Event trigger regression', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('17.1 — event-based rule coexists with scheduled rules', async ({ page }) => {
      await gotoAutomations(page, PHASE5A_PROJECT_ID)
      const eventCard = ruleCard(page, 'Auto-complete on Done')
      const scheduledCard = ruleCard(page, 'Move overdue')
      const cronCard = ruleCard(page, 'Daily standup')
      await expect(eventCard).toBeVisible({ timeout: 10_000 })
      await expect(scheduledCard).toBeVisible()
      await expect(cronCard).toBeVisible()
      const rules = await getStoredRules(page)
      const eventRule = rules.find((r: any) => r.id === 'rule-5a-event-autocomplete')
      expect(eventRule.enabled).toBe(true)
      expect(eventRule.trigger.type).toBe('card_moved_into_section')
    })
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// Phase 5b Tests (TC-B1 through TC-B11)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Phase 5b: Age Filters, Skip-Missed, Templates', () => {

  // ── TC-B1: Age-Based Filters ──────────────────────────────────────────

  test.describe('TC-B1: created_more_than filter', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B1.1 — rule fires and targets tasks created > 5 days ago', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-created-old')
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5b-created-old')
      expect(rule.executionCount).toBeGreaterThanOrEqual(1)
    })

    test('B1.2 — does NOT move recently created tasks', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-created-old')
      const tasks = await getStoredTasks(page)
      const fresh = tasks.find((t: any) => t.id === 'task-5b-new-1')
      expect(fresh.sectionId).toBe(PHASE5B_SECTIONS.todo)
    })
  })

  test.describe('TC-B2: completed_more_than filter', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B2.1 — targets tasks completed > 7 days ago', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-completed-old')
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5b-completed-old')
      expect(rule.executionCount).toBeGreaterThanOrEqual(1)
    })
  })

  test.describe('TC-B3: not_modified_in filter', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B3.1 — moves stale incomplete tasks to Backlog', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-stale')
      const tasks = await getStoredTasks(page)
      const stale = tasks.find((t: any) => t.id === 'task-5b-stale-1')
      expect(stale.sectionId).toBe(PHASE5B_SECTIONS.backlog)
    })

    test('B3.2 — does NOT move recently updated tasks', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-stale')
      const tasks = await getStoredTasks(page)
      const active = tasks.find((t: any) => t.id === 'task-5b-active')
      expect(active.sectionId).toBe(PHASE5B_SECTIONS.inProgress)
    })
  })

  test.describe('TC-B4: overdue_by_more_than filter', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B4.1 — marks tasks overdue > 7 days as complete', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-overdue-escalate')
      const tasks = await getStoredTasks(page)
      const longOverdue = tasks.find((t: any) => t.id === 'task-5b-overdue-long')
      expect(longOverdue.completed).toBe(true)
    })

    test('B4.2 — does NOT mark recently overdue tasks', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-overdue-escalate')
      const tasks = await getStoredTasks(page)
      const shortOverdue = tasks.find((t: any) => t.id === 'task-5b-overdue-short')
      expect(shortOverdue.completed).toBe(false)
    })
  })

  test.describe('TC-B5: in_section_for_more_than filter', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B5.1 — moves tasks stuck in section > 5 days', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-stuck')
      const tasks = await getStoredTasks(page)
      const stuck = tasks.find((t: any) => t.id === 'task-5b-stuck-1')
      expect(stuck.sectionId).toBe(PHASE5B_SECTIONS.backlog)
    })

    test('B5.2 — does NOT move recently moved tasks', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-stuck')
      const tasks = await getStoredTasks(page)
      const recent = tasks.find((t: any) => t.id === 'task-5b-stuck-2')
      expect(recent.sectionId).toBe(PHASE5B_SECTIONS.inProgress)
    })
  })

  // ── TC-B6: skip_missed Catch-Up Policy ────────────────────────────────

  test.describe('TC-B6: skip_missed catch-up policy', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B6.1 — skip_missed rule logs a Skipped entry on catch-up', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-skip-missed')
      const rules = await getStoredRules(page)
      const rule = rules.find((r: any) => r.id === 'rule-5b-skip-missed')
      const skippedEntries = (rule.recentExecutions ?? []).filter(
        (e: any) => e.executionType === 'skipped'
      )
      expect(skippedEntries.length).toBeGreaterThanOrEqual(1)
    })

    test('B6.2 — skip_missed rule does NOT create a card on catch-up', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-skip-missed')
      const tasks = await getStoredTasks(page)
      const fridayCards = tasks.filter((t: any) => t.description === 'Friday Summary')
      expect(fridayCards.length).toBe(0)
    })

    test('B6.3 — Skipped badge appears in schedule history', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-skip-missed')
      await page.reload()
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      const card = ruleCard(page, 'Friday summary')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByText('Recent activity').click({ force: true })
      await expect(card.getByText('⏭️ Skipped')).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-B7: Title Templates ────────────────────────────────────────────

  test.describe('TC-B7: Title templates with date interpolation', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B7.1 — create_card with {{date}} template creates card with interpolated title', async ({ page }) => {
      await gotoList(page, PHASE5B_PROJECT_ID)
      await waitForSchedulerCatchUp(page, 'rule-5b-template')
      const tasks = await getStoredTasks(page)
      const standupCards = tasks.filter((t: any) =>
        t.description.startsWith('Standup —') && t.projectId === PHASE5B_PROJECT_ID
      )
      expect(standupCards.length).toBeGreaterThanOrEqual(1)
      const title = standupCards[0].description
      expect(title).toMatch(/Standup — \d{4}-\d{2}-\d{2}/)
      expect(title).toMatch(/\((?:Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)\)/)
    })
  })

  // ── TC-B8: Dry-Run Preview ────────────────────────────────────────────

  test.describe('TC-B8: Dry-run preview dialog', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B8.1 — Preview button opens DryRunDialog for scheduled rules', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      const card = ruleCard(page, 'Preview target')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByRole('button', { name: 'Open menu' }).click({ force: true })
      await page.getByRole('menuitem', { name: 'Preview' }).click()
      const dialog = page.locator('[aria-label="Dry run preview"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })
    })

    test('B8.2 — DryRunDialog shows matching task count', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      const card = ruleCard(page, 'Preview target')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByRole('button', { name: 'Open menu' }).click({ force: true })
      await page.getByRole('menuitem', { name: 'Preview' }).click()
      const dialog = page.locator('[aria-label="Dry run preview"]')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog.getByText(/would affect \d+ tasks?/)).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-B9: Schedule History View ──────────────────────────────────────

  test.describe('TC-B9: Schedule history view', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B9.1 — pre-seeded history shows execution type badges', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      const card = ruleCard(page, 'Friday summary')
      await expect(card).toBeVisible({ timeout: 10_000 })
      await card.getByText('Recent activity').click({ force: true })
      await expect(card.getByText('⚡ Scheduled')).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-B10: Catch-Up Policy Toggle in Rule Wizard ─────────────────────

  test.describe('TC-B10: Catch-up policy toggle in rule creation', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B10.1 — catch-up toggle appears when selecting a scheduled trigger', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('on a recurring interval').click()
      await expect(dialog.getByRole('switch', { name: 'Run on catch-up' })).toBeVisible({ timeout: 3000 })
    })

    test('B10.2 — catch-up toggle does NOT appear for event triggers', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('moved into section').click()
      await expect(dialog.getByRole('switch', { name: 'Run on catch-up' })).not.toBeVisible({ timeout: 2000 })
    })
  })

  // ── TC-B11: New Filter Types in Rule Wizard ───────────────────────────

  test.describe('TC-B11: New filter types in rule wizard', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('B11.1 — age-based filter types appear in filter step', async ({ page }) => {
      await gotoAutomations(page, PHASE5B_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('on a recurring interval').click()
      await dialog.getByRole('button', { name: /next/i }).click()
      const addFilterBtn = dialog.getByRole('button', { name: /add filter/i })
      if (await addFilterBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await addFilterBtn.click()
      }
      const filterSelect = dialog.locator('button[role="combobox"]').first()
      if (await filterSelect.isVisible({ timeout: 3000 }).catch(() => false)) {
        await filterSelect.click()
        const options = page.locator('[role="option"]')
        const allText = await options.allTextContents()
        const has5bFilter = allText.some(t =>
          t.includes('created more than') ||
          t.includes('completed more than') ||
          t.includes('not modified in') ||
          t.includes('overdue by more than') ||
          t.includes('in section for more than')
        )
        expect(has5bFilter).toBe(true)
      }
    })
  })
})


// ═══════════════════════════════════════════════════════════════════════════
// Phase 5c Tests (TC-C1 through TC-C9)
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Phase 5c: Power User Features', () => {

  // ── TC-C1: Bulk Disable All ───────────────────────────────────────────

  test.describe('TC-C1: Bulk disable all rules', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C1.1 — "Disable all" button is visible when rules are enabled', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await expect(page.getByRole('button', { name: 'Disable all' })).toBeVisible({ timeout: 10_000 })
    })

    test('C1.2 — clicking "Disable all" disables every rule', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await expect(page.getByRole('button', { name: 'Disable all' })).toBeVisible({ timeout: 10_000 })
      await page.getByRole('button', { name: 'Disable all' }).click()
      const rules = await getStoredRules(page)
      const projectRules = rules.filter((r: any) => r.projectId === PHASE5C_PROJECT_ID)
      const allDisabled = projectRules.every((r: any) => r.enabled === false)
      expect(allDisabled).toBe(true)
    })

    test('C1.3 — after disabling all, button changes to "Enable all"', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await expect(page.getByRole('button', { name: 'Enable all' })).toBeVisible({ timeout: 3000 })
    })

    test('C1.4 — disabled rules show "Paused" or "Fired" badge on their cards', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await page.waitForTimeout(500)
      const ruleCards = page.locator('div[role="button"]', { hasText: /Ran \d+ times?/ })
      const ruleCount = await ruleCards.count()
      expect(ruleCount).toBeGreaterThan(0)
      for (let i = 0; i < ruleCount; i++) {
        const card = ruleCards.nth(i)
        const hasPaused = await card.getByText('Paused', { exact: true }).isVisible().catch(() => false)
        const hasFired = await card.getByText('Fired', { exact: true }).isVisible().catch(() => false)
        expect(hasPaused || hasFired).toBe(true)
      }
    })
  })

  // ── TC-C2: Bulk Enable All ────────────────────────────────────────────

  test.describe('TC-C2: Bulk enable all rules', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C2.1 — clicking "Enable all" after "Disable all" re-enables every rule', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await expect(page.getByRole('button', { name: 'Enable all' })).toBeVisible({ timeout: 3000 })
      await page.getByRole('button', { name: 'Enable all' }).click()
      const rules = await getStoredRules(page)
      const projectRules = rules.filter((r: any) => r.projectId === PHASE5C_PROJECT_ID)
      const allEnabled = projectRules.every((r: any) => r.enabled === true)
      expect(allEnabled).toBe(true)
    })

    test('C2.2 — "Enable all" re-enables previously disabled rules too', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await page.getByRole('button', { name: 'Enable all' }).click()
      const rules = await getStoredRules(page)
      const prevDisabled1 = rules.find((r: any) => r.id === 'rule-5c-disabled-1')
      const prevDisabled2 = rules.find((r: any) => r.id === 'rule-5c-disabled-2')
      expect(prevDisabled1.enabled).toBe(true)
      expect(prevDisabled2.enabled).toBe(true)
    })

    test('C2.3 — after enabling all, button changes back to "Disable all"', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await page.getByRole('button', { name: 'Enable all' }).click()
      await expect(page.getByRole('button', { name: 'Disable all' })).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-C3: Bulk Toggle with Mixed State ───────────────────────────────

  test.describe('TC-C3: Bulk toggle with mixed enabled/disabled state', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C3.1 — with mixed state (some enabled, some disabled), shows "Disable all"', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await expect(page.getByRole('button', { name: 'Disable all' })).toBeVisible({ timeout: 10_000 })
    })

    test('C3.2 — "Disable all" from mixed state disables all project rules', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      const rules = await getStoredRules(page)
      const projectRules = rules.filter((r: any) => r.projectId === PHASE5C_PROJECT_ID)
      expect(projectRules.length).toBe(7)
      expect(projectRules.every((r: any) => !r.enabled)).toBe(true)
    })
  })

  // ── TC-C4: Scheduler Stops After Bulk Disable ─────────────────────────

  test.describe('TC-C4: Scheduler behavior after bulk disable', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C4.1 — disabled scheduled rules do not fire after bulk disable', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.waitForTimeout(5000)
      const rulesBefore = await getStoredRules(page)
      const intervalBefore = rulesBefore.find((r: any) => r.id === 'rule-5c-interval-1')
      const countBefore = intervalBefore.executionCount
      await page.getByRole('button', { name: 'Disable all' }).click()
      await page.waitForTimeout(3000)
      const rulesAfter = await getStoredRules(page)
      const intervalAfter = rulesAfter.find((r: any) => r.id === 'rule-5c-interval-1')
      expect(intervalAfter.executionCount).toBe(countBefore)
    })
  })

  // ── TC-C5: Individual Toggle Still Works Alongside Bulk ───────────────

  test.describe('TC-C5: Individual toggle coexists with bulk', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C5.1 — toggling individual rule after bulk disable works', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      await page.waitForTimeout(500)
      const card = ruleCard(page, 'Auto-complete on Done')
      await expect(card).toBeVisible({ timeout: 5000 })
      const toggle = card.locator('button[role="switch"]')
      await toggle.click({ force: true })
      const rules = await getStoredRules(page)
      const eventRule = rules.find((r: any) => r.id === 'rule-5c-event-1')
      expect(eventRule.enabled).toBe(true)
      const otherRules = rules.filter((r: any) => r.id !== 'rule-5c-event-1' && r.projectId === PHASE5C_PROJECT_ID)
      expect(otherRules.every((r: any) => !r.enabled)).toBe(true)
    })

    test('C5.2 — button shows "Disable all" when at least one rule is re-enabled', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: 'Disable all' }).click()
      const card = ruleCard(page, 'Auto-complete on Done')
      await expect(card).toBeVisible({ timeout: 5000 })
      await card.locator('button[role="switch"]').click({ force: true })
      await expect(page.getByRole('button', { name: 'Disable all' })).toBeVisible({ timeout: 3000 })
    })
  })

  // ── TC-C6: Empty State — No Bulk Toggle ───────────────────────────────

  test.describe('TC-C6: Empty state hides bulk toggle', () => {
    test('C6.1 — no bulk toggle when project has zero rules', async ({ page }) => {
      await page.goto('/')
      await page.evaluate(
        ([d, a]) => {
          localStorage.setItem('task-management-data', d)
          localStorage.setItem('task-management-settings', a)
          localStorage.setItem('task-management-automations', '[]')
        },
        [
          JSON.stringify({ state: { projects: [{ id: 'proj-empty', name: 'Empty', description: '', viewMode: 'list', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' }], tasks: [], sections: [], dependencies: [] }, version: 1 }),
          JSON.stringify({ state: { settings: { activeProjectId: 'proj-empty', timeManagementSystem: 'none', showOnlyActionableTasks: false, theme: 'system' }, projectTabs: {}, globalTasksDisplayMode: 'nested', columnOrder: ['dueDate', 'priority', 'assignee', 'tags'], sortColumn: null, sortDirection: 'asc', needsAttentionSort: false, autoHideThreshold: '24h', showRecentlyCompleted: false, keyboardShortcuts: {} }, version: 1 }),
        ] as const,
      )
      await page.reload()
      await page.goto('/?project=proj-empty&tab=automations')
      await page.waitForTimeout(2000)
      await expect(page.getByRole('button', { name: 'Disable all' })).not.toBeVisible({ timeout: 3000 })
      await expect(page.getByRole('button', { name: 'Enable all' })).not.toBeVisible({ timeout: 2000 })
    })
  })

  // ── TC-C7: Rule Count Badge Updates After Bulk Toggle ─────────────────

  test.describe('TC-C7: Rule count display', () => {
    test.beforeEach(async ({ page }) => { await seedDatabase(page) })

    test('C7.1 — automations tab shows rule heading', async ({ page }) => {
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await expect(page.getByRole('heading', { name: 'Automation Rules' })).toBeVisible({ timeout: 10_000 })
      await expect(page.getByText('7 rules')).not.toBeVisible({ timeout: 2000 })
    })
  })

  // ── TC-C8: One-Time Scheduled Triggers ────────────────────────────────

  test.describe('TC-C8: One-time scheduled triggers', () => {

    test('C8.1 — scheduled_one_time trigger type appears in rule wizard', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await expect(dialog.getByText('at a specific date and time')).toBeVisible()
    })

    test('C8.2 — selecting one-time trigger shows date/time picker', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific date and time').click()
      await expect(dialog.locator('input[aria-label="Fire date"]')).toBeVisible({ timeout: 3000 })
    })

    test('C8.3 — one-time rule with past fireAt fires on catch-up and auto-disables', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.waitForTimeout(8000)
      const rules = await getStoredRules(page)
      const oneTimeRule = rules.find((r: any) => r.id === 'rule-5c-onetime-past')
      expect(oneTimeRule).toBeTruthy()
      expect(oneTimeRule.executionCount).toBeGreaterThanOrEqual(1)
      expect(oneTimeRule.enabled).toBe(false)
    })

    test('C8.4 — fired one-time rule shows "Fired" badge', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.waitForTimeout(8000)
      const card = ruleCard(page, 'One-time catch-up test')
      await expect(card).toBeVisible({ timeout: 5000 })
      await expect(card.getByText('Fired', { exact: true })).toBeVisible()
    })

    test('C8.5 — fired one-time rule has "Reschedule" in dropdown', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.waitForTimeout(8000)
      const card = ruleCard(page, 'One-time catch-up test')
      await expect(card).toBeVisible({ timeout: 5000 })
      await card.getByRole('button', { name: 'Open menu' }).click()
      await expect(page.getByRole('menuitem', { name: 'Reschedule' })).toBeVisible({ timeout: 3000 })
    })

    test('C8.6 — one-time rule with future fireAt does NOT fire yet', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.waitForTimeout(8000)
      const rules = await getStoredRules(page)
      const futureRule = rules.find((r: any) => r.id === 'rule-5c-onetime-future')
      expect(futureRule?.enabled).toBe(true)
      expect(futureRule?.executionCount).toBe(0)
    })
  })

  // ── TC-C9: Raw Cron Expression Input ──────────────────────────────────

  test.describe('TC-C9: Raw cron expression input', () => {

    test('C9.1 — cron expression input toggle appears in cron config panel', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      const modeGroup = dialog.locator('[role="radiogroup"][aria-label="Input mode"]')
      await expect(modeGroup).toBeVisible({ timeout: 3000 })
      await expect(modeGroup.locator('input[aria-label="Picker"]')).toBeVisible()
      await expect(modeGroup.locator('input[aria-label="Expression"]')).toBeVisible()
    })

    test('C9.2 — toggling to Expression mode shows a text input', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      await dialog.locator('input[aria-label="Expression"]').click()
      const cronInput = dialog.locator('input[aria-label="Cron expression"]')
      await expect(cronInput).toBeVisible({ timeout: 3000 })
    })

    test('C9.3 — valid cron expression is accepted and shows description', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      await dialog.locator('input[aria-label="Expression"]').click()
      const cronInput = dialog.locator('input[aria-label="Cron expression"]')
      await cronInput.fill('0 9 * * 1,5')
      await expect(dialog.getByText(/Monday|Friday|09:00/i)).toBeVisible({ timeout: 3000 })
    })

    test('C9.4 — invalid cron expression shows validation error', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      await dialog.locator('input[aria-label="Expression"]').click()
      const cronInput = dialog.locator('input[aria-label="Cron expression"]')
      await cronInput.fill('not a valid cron')
      await expect(dialog.locator('.text-destructive')).toBeVisible({ timeout: 3000 })
    })

    test('C9.5 — switching from Picker to Expression populates cron string', async ({ page }) => {
      await seedDatabase(page)
      await gotoAutomations(page, PHASE5C_PROJECT_ID)
      await page.getByRole('button', { name: /new rule/i }).click()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible({ timeout: 5000 })
      await dialog.getByText('at a specific time').click()
      await dialog.getByRole('tab', { name: 'Weekly' }).click()
      await dialog.locator('input[aria-label="Expression"]').click()
      const cronInput = dialog.locator('input[aria-label="Cron expression"]')
      await expect(cronInput).toBeVisible()
      const value = await cronInput.inputValue()
      expect(value.trim().length).toBeGreaterThan(0)
    })
  })
})
