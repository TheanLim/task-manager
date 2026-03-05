import { test, expect } from '@playwright/test'
import { seedDatabase, PROJECT_ID, PROJECT_2_ID } from './fixtures/seed-data'

// Use current time so the default 7d date-range filter doesn't exclude entries
const NOW = new Date().toISOString()
const AUTOMATIONS_URL = '/?view=automations'

// Force serial — the Next.js dev server shares module state across parallel workers
test.describe.configure({ mode: 'serial' })

/** Seed a global rule into localStorage then navigate to targetUrl */
async function seedGlobalRule(
  page: import('@playwright/test').Page,
  rule: Record<string, unknown>,
  targetUrl: string = '/',
) {
  await page.evaluate((ruleJson) => {
    const existing = JSON.parse(localStorage.getItem('task-management-automations') || '[]')
    existing.push(JSON.parse(ruleJson))
    localStorage.setItem('task-management-automations', JSON.stringify(existing))
  }, JSON.stringify(rule))
  await page.goto(targetUrl)
}

function makeGlobalRule(overrides: Record<string, unknown> = {}) {
  return {
    id: 'global-rule-001', projectId: null,
    name: 'Global Auto-complete',
    trigger: { type: 'card_marked_complete', sectionId: null },
    filters: [],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true, brokenReason: null,
    executionCount: 0, lastExecutedAt: null, recentExecutions: [],
    order: 99, createdAt: NOW, updatedAt: NOW,
    excludedProjectIds: [], scope: 'all', selectedProjectIds: [],
    ...overrides,
  }
}

function makeSkipEntry(taskName: string, projectId = PROJECT_ID) {
  return { timestamp: NOW, triggerDescription: 'Card moved', actionDescription: 'Move to Done', taskName, executionType: 'skipped', isGlobal: true, firingProjectId: projectId, skipReason: "Section 'Done' not found", ruleId: 'global-rule-001' }
}

function makeFireEntry(taskName: string, projectId = PROJECT_ID) {
  return { timestamp: NOW, triggerDescription: 'Card marked complete', actionDescription: 'Mark complete', taskName, executionType: 'event', isGlobal: true, firingProjectId: projectId, ruleId: 'global-rule-001' }
}

// ── E2E-1: Create a global rule with "Selected Projects" scope ──────────────

test.describe('Phase 2 — E2E-1: Scope step in global rule wizard', () => {
  test('wizard shows Scope as step 1 for global rules', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /\+ New Rule/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('New Global Rule')).toBeVisible()
    // Step indicator uses navigation landmark
    const nav = dialog.getByRole('navigation', { name: 'Wizard steps' })
    await expect(nav.getByText('Scope')).toBeVisible()
    await expect(nav.getByText('Trigger')).toBeVisible()
    // All Projects radio selected by default
    await expect(dialog.getByRole('radio', { name: 'All Projects' })).toBeChecked()
    await expect(dialog.getByRole('radio', { name: 'Selected Projects' })).toBeVisible()
  })

  test('selecting "Selected Projects" shows project multi-picker', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /\+ New Rule/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: 'Selected Projects' }).click()
    await expect(dialog.getByPlaceholder('Search projects...')).toBeVisible()
    await expect(dialog.getByText('Seed Project Alpha')).toBeVisible()
    await expect(dialog.getByText('Seed Project Beta')).toBeVisible()
    await expect(dialog.getByText('Select at least one project to continue.')).toBeVisible()
  })

  test('selecting projects updates count and enables Next', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /\+ New Rule/i }).click()

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('radio', { name: 'Selected Projects' }).click()
    await dialog.getByText('Seed Project Alpha').click()
    await dialog.getByText('Seed Project Beta').click()
    await expect(dialog.getByText('2 of 2 projects selected')).toBeVisible()
    // Validation error gone
    await expect(dialog.getByText('Select at least one project to continue.')).not.toBeVisible()
  })

  test('scope badge shows "Scope: All Projects" by default', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /\+ New Rule/i }).click()
    await expect(page.getByRole('dialog').getByText('Scope: All Projects')).toBeVisible()
  })
})

// ── E2E-2: Per-project disable override ──────────────────────────────────────

test.describe('Phase 2 — E2E-2: Per-project scope visibility', () => {
  test('global rule with scope:all appears in project AutomationTab', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), `/?project=${PROJECT_ID}&tab=automations`)
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Auto-complete')).toBeVisible()
  })

  test('"Manage" link navigates to global panel', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), `/?project=${PROJECT_ID}&tab=automations`)
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })
    // Use first() since there may be multiple Manage buttons
    await page.getByText('Manage').first().click()
    await expect(page.getByText('Rules that run across all your projects automatically.')).toBeVisible({ timeout: 5000 })
  })

  test('scope:selected rule appears only in selected project', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(
      page,
      makeGlobalRule({ scope: 'selected', selectedProjectIds: [PROJECT_ID] }),
      `/?project=${PROJECT_ID}&tab=automations`,
    )
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Auto-complete')).toBeVisible()

    // Not visible in PROJECT_2_ID
    await page.goto(`/?project=${PROJECT_2_ID}&tab=automations`)
    await expect(page.getByText('Automate repetitive work')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Rules')).not.toBeVisible()
  })

  test('scope:selected rule does not appear in non-selected project', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(
      page,
      makeGlobalRule({ scope: 'selected', selectedProjectIds: [PROJECT_2_ID] }),
      `/?project=${PROJECT_ID}&tab=automations`,
    )
    // Wait for the automation tab to render
    await expect(page.getByText('Automation Rules')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Rules')).not.toBeVisible()
  })

  test('excluded project still shows rule in Global Rules section (for toggle)', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(
      page,
      makeGlobalRule({ scope: 'all', excludedProjectIds: [PROJECT_ID] }),
      `/?project=${PROJECT_ID}&tab=automations`,
    )
    // Per spec Q2: excluded rules remain visible so user can toggle them back on
    await expect(page.getByText('Global Rules')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Global Auto-complete')).toBeVisible()
  })
})

// ── E2E-3: Cross-project execution log with filtering ───────────────────────

test.describe('Phase 2 — E2E-3: Cross-project execution log', () => {
  test('execution log tab shows entries from multiple projects', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Alpha', PROJECT_ID), makeFireEntry('Task Beta', PROJECT_2_ID), makeSkipEntry('Task Skipped', PROJECT_ID)],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })

    await page.getByRole('tab', { name: /execution log/i }).click()
    // Need to set date filter to "All time" since default is 7d
    await page.getByRole('button', { name: /filter by date/i }).click()
    await page.getByRole('menuitem', { name: /all time/i }).click()

    await expect(page.getByText('Task Alpha')).toBeVisible()
    await expect(page.getByText('Task Beta')).toBeVisible()
    await expect(page.getByText('Task Skipped')).toBeVisible()
    await expect(page.getByText('Seed Project Alpha').first()).toBeVisible()
    await expect(page.getByText('Seed Project Beta').first()).toBeVisible()
  })

  test('log tab shows Project column header', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Alpha')],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: /execution log/i }).click()
    // The table uses <th> elements
    await expect(page.locator('th', { hasText: 'Project' })).toBeVisible()
  })

  test('log tab shows entry count text', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Alpha'), makeFireEntry('Task Beta', PROJECT_2_ID), makeSkipEntry('Task Skipped')],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: /execution log/i }).click()
    // Count text rendered by ExecutionLogFilterBar
    await expect(page.getByText(/Showing \d+ entries/i).first()).toBeVisible()
  })

  test('outcome filter shows only skipped entries', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Alpha'), makeSkipEntry('Task Skipped')],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: /execution log/i }).click()
    // Set date to all time first
    await page.getByRole('button', { name: /filter by date/i }).click()
    await page.getByRole('menuitem', { name: /all time/i }).click()
    // Apply outcome filter
    await page.getByRole('button', { name: /filter by outcome/i }).click()
    await page.getByRole('menuitem', { name: /^Skipped/ }).click()

    await expect(page.getByText('Task Skipped')).toBeVisible()
    await expect(page.getByText('Task Alpha')).not.toBeVisible()
  })

  test('clear filters restores all entries', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Alpha'), makeSkipEntry('Task Skipped')],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.getByRole('tab', { name: /execution log/i }).click()
    // Set date to all time
    await page.getByRole('button', { name: /filter by date/i }).click()
    await page.getByRole('menuitem', { name: /all time/i }).click()
    // Apply outcome filter
    await page.getByRole('button', { name: /filter by outcome/i }).click()
    await page.getByRole('menuitem', { name: /^Skipped/ }).click()
    await expect(page.getByText('Task Alpha')).not.toBeVisible()
    // Clear
    await page.getByRole('button', { name: /clear filters/i }).click()
    await expect(page.getByText('Task Alpha')).toBeVisible()
    await expect(page.getByText('Task Skipped')).toBeVisible()
  })

  test('log tab badge shows skip count', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeSkipEntry('Task Skipped')],
    }), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/1 skipped/i)).toBeVisible()
  })
})

// ── E2E-4: Global rule panel CRUD ────────────────────────────────────────────

test.describe('Phase 2 — E2E-4: Global rule panel CRUD', () => {
  test('global rule appears in panel after seeding', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
  })

  test('global rule card shows ScopePill with "All Projects" badge', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    // ScopePill renders "All Projects" badge for scope: 'all'
    await expect(page.getByText('All Projects').first()).toBeVisible()
  })

  test('new global rule wizard opens with "New Global Rule" title and Scope step', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: /\+ New Rule/i }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('New Global Rule')).toBeVisible()
    const nav = dialog.getByRole('navigation', { name: 'Wizard steps' })
    await expect(nav.getByText('Scope')).toBeVisible()
  })

  test('global rule card has enabled toggle', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    const toggle = page.locator('[role="switch"]').first()
    await expect(toggle).toBeVisible()
    await expect(toggle).toBeChecked()
  })

  test('disabling toggle marks card as disabled', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.locator('[role="switch"]').first().click()
    await expect(page.locator('.opacity-60')).toBeVisible()
  })

  test('context menu has Edit and Delete', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    // Use exact match to avoid the sortable wrapper also matching
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
    await expect(page.getByRole('menuitem', { name: /delete/i })).toBeVisible()
  })

  test('editing opens wizard with "Edit Global Rule" title', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule(), AUTOMATIONS_URL)
    await expect(page.getByText('Global Auto-complete')).toBeVisible({ timeout: 10000 })
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('menuitem', { name: 'Edit' }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Edit Global Rule')).toBeVisible()
  })

  test('compact toggle button is visible in panel header', async ({ page }) => {
    await seedDatabase(page, undefined, AUTOMATIONS_URL)
    await expect(page.getByText('No global rules yet')).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /compact|expanded/i })).toBeVisible()
  })
})

// ── E2E-5: Project rule card context menu ────────────────────────────────────

test.describe('Phase 2 — E2E-5: Project rule card context menu', () => {
  test('project rule card has "Open menu" context button', async ({ page }) => {
    await seedDatabase(page, undefined, `/?project=${PROJECT_ID}&tab=automations`)
    await expect(page.getByText('Automation Rules')).toBeVisible({ timeout: 10000 })
    // Use exact match to target the actual menu button, not the sortable wrapper
    const menuBtn = page.getByRole('button', { name: 'Open menu', exact: true }).first()
    await expect(menuBtn).toBeVisible()
    await menuBtn.click()
    await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible()
  })
})

// ── E2E-6: Amber badge → filtered log navigation ─────────────────────────────

test.describe('Phase 2 — E2E-6: Amber badge navigation', () => {
  test('amber badge appears in sidebar when global rule has skipped entries', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({ recentExecutions: [makeSkipEntry('Task Skipped')] }), '/')
    await expect(page.getByText('1').first()).toBeVisible({ timeout: 5000 })
  })

  test('Automations nav link has correct href with tab=log&outcome=skipped on badge', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({ recentExecutions: [makeSkipEntry('Task Skipped')] }), '/')
    // The badge link (not the main nav link) goes to the filtered log
    const badgeLink = page.getByRole('link', { name: /view skipped automations/i })
    await expect(badgeLink).toBeVisible({ timeout: 5000 })
    const href = await badgeLink.getAttribute('href')
    expect(href).toContain('tab=log')
    expect(href).toContain('outcome=skipped')
  })

  test('navigating to log tab with outcome=skipped pre-filters to skipped', async ({ page }) => {
    await seedDatabase(page)
    await seedGlobalRule(page, makeGlobalRule({
      recentExecutions: [makeFireEntry('Task Fired'), makeSkipEntry('Task Skipped 1'), makeSkipEntry('Task Skipped 2'), makeSkipEntry('Task Skipped 3')],
    }), '/?view=automations&tab=log&outcome=skipped')

    // Execution Log tab is active
    const logTab = page.getByRole('tab', { name: /execution log/i })
    await expect(logTab).toBeVisible({ timeout: 10000 })
    await expect(logTab).toHaveAttribute('data-state', 'active')

    // Set date to all time to see all entries
    await page.getByRole('button', { name: /filter by date/i }).click()
    await page.getByRole('menuitem', { name: /all time/i }).click()

    // Skipped entries visible, fired entry hidden (outcome pre-filtered)
    await expect(page.getByText('Task Skipped 1')).toBeVisible()
    await expect(page.getByText('Task Skipped 2')).toBeVisible()
    await expect(page.getByText('Task Skipped 3')).toBeVisible()
    await expect(page.getByText('Task Fired')).not.toBeVisible()
  })

  test('badge count matches number of rules with skipped entries', async ({ page }) => {
    await seedDatabase(page)
    // Seed 3 separate global rules, each with a skip entry → badge should show "3"
    const rule1 = makeGlobalRule({ id: 'gr-1', name: 'Rule 1', recentExecutions: [makeSkipEntry('S1')] })
    const rule2 = makeGlobalRule({ id: 'gr-2', name: 'Rule 2', recentExecutions: [{ ...makeSkipEntry('S2'), ruleId: 'gr-2' }] })
    const rule3 = makeGlobalRule({ id: 'gr-3', name: 'Rule 3', recentExecutions: [{ ...makeSkipEntry('S3'), ruleId: 'gr-3' }] })
    await page.evaluate(([r1, r2, r3]) => {
      const existing = JSON.parse(localStorage.getItem('task-management-automations') || '[]')
      existing.push(JSON.parse(r1), JSON.parse(r2), JSON.parse(r3))
      localStorage.setItem('task-management-automations', JSON.stringify(existing))
    }, [JSON.stringify(rule1), JSON.stringify(rule2), JSON.stringify(rule3)])
    await page.goto('/')
    // The badge link shows the count
    const badgeLink = page.getByRole('link', { name: /view skipped automations/i })
    await expect(badgeLink).toBeVisible({ timeout: 5000 })
    await expect(badgeLink.getByText('3')).toBeVisible()
  })
})
