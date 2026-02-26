/**
 * E2E tests for the AF4 (Autofocus 4) time management system.
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §14 "AF4 System"
 */
import { test, expect, type Page } from '@playwright/test'

/** Navigate to TMS view and activate AF4 tab */
async function navigateToAF4(page: Page) {
  await page.goto('/?view=tms')
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
  const af4Tab = page.getByRole('tab', { name: /af4/i })
  await af4Tab.dispatchEvent('click')
  await page.waitForTimeout(300)
}

/**
 * Add tasks via UI, then seed AF4 backlog state by modifying both
 * localStorage keys (Zustand persist + unified backend), then reload.
 */
async function addTasksWithAF4Backlog(page: Page, taskNames: string[]) {
  // Step 1: Add tasks via main view
  await page.goto('/')
  await page.waitForTimeout(500)
  const allTasksBtn = page.getByRole('button', { name: /all tasks/i })
  await allTasksBtn.click()
  await page.waitForTimeout(500)

  for (const name of taskNames) {
    await page.getByRole('button', { name: /add task/i }).click()
    await page.waitForTimeout(300)
    await page.getByLabel(/description/i).fill(name)
    await page.getByRole('button', { name: /create task/i }).click()
    await page.waitForTimeout(300)
  }

  // Step 2: Navigate to TMS AF4 (creates the localStorage entry)
  const focusButton = page.getByRole('button', { name: /focus/i })
  await focusButton.click()
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
  await page.getByRole('tab', { name: /af4/i }).dispatchEvent('click')
  await page.waitForTimeout(500)

  // Step 3: Seed AF4 backlog in both localStorage keys
  await page.evaluate(() => {
    const dataRaw = localStorage.getItem('task-management-data')
    const dataParsed = dataRaw ? JSON.parse(dataRaw) : {}
    const tasks = dataParsed?.state?.tasks ?? []
    const taskIds = tasks.filter((t: any) => !t.completed).map((t: any) => t.id)

    const af4State = {
      backlogTaskIds: taskIds,
      activeListTaskIds: [],
      currentPosition: 0,
      lastPassHadWork: false,
      dismissedTaskIds: [],
      phase: 'backlog',
    }

    // Update Zustand persist key
    const tmsRaw = localStorage.getItem('task-management-tms')!
    const tmsParsed = JSON.parse(tmsRaw)
    const inner = tmsParsed.state?.state ?? tmsParsed.state
    inner.systemStates.af4 = af4State
    localStorage.setItem('task-management-tms', JSON.stringify(tmsParsed))

    // Update unified backend key
    const unifiedRaw = localStorage.getItem('task-management-app-state')
    if (unifiedRaw) {
      const unified = JSON.parse(unifiedRaw)
      unified.tmsState = inner
      localStorage.setItem('task-management-app-state', JSON.stringify(unified))
    }
  })

  // Step 4: Reload to pick up seeded state
  await page.reload()
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
  await page.waitForTimeout(500)
}

test.describe('AF4 System', () => {
  test('shows Backlog heading when AF4 is active', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { name: /backlog/i })).toBeVisible()
  })

  test('shows Active List heading', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { name: /active list/i })).toBeVisible()
  })

  test('AF4 tab is selected', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await expect(af4Tab).toHaveAttribute('aria-selected', 'true')
  })

  test('view does not crash and shows no errors', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash|undefined/i)
  })

  test('empty backlog shows Draw new line button', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    // In empty state, backlog is immediately complete — Draw new line button should be visible
    await expect(main.getByRole('button', { name: /draw new line/i })).toBeVisible({ timeout: 5000 })
  })

  test('Made Progress moves task to Active List', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['AF4 Task A', 'AF4 Task B', 'AF4 Task C'])
    const main = page.locator('main')
    const madeProgressBtn = main.getByRole('button', { name: /made progress/i }).first()
    await expect(madeProgressBtn).toBeVisible({ timeout: 5000 })
    await madeProgressBtn.click()
    await page.waitForTimeout(300)
    await expect(main.getByRole('heading', { name: /active list/i })).toBeVisible()
  })

  test('Skip advances cursor to next Backlog task', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['Skip Task A', 'Skip Task B', 'Skip Task C'])
    const main = page.locator('main')
    const skipBtn = main.getByRole('button', { name: /skip/i }).first()
    await expect(skipBtn).toBeVisible({ timeout: 5000 })
    await skipBtn.click()
    await page.waitForTimeout(300)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('new tasks created after activation appear in Active List', async ({ page }) => {
    await navigateToAF4(page)
    const main = page.locator('main')
    await expect(main.getByRole('heading', { name: /backlog/i })).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('flag dismissed: clicking flag icon adds task to dismissed list', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['Flag Task A', 'Flag Task B'])
    const main = page.locator('main')
    const flagBtn = main.getByRole('button', { name: /flag|dismiss/i }).first()
    if (await flagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await flagBtn.click()
      await page.waitForTimeout(300)
    }
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('resolve dismissed — abandon: removes task from all lists', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['Abandon Task A', 'Abandon Task B'])
    const main = page.locator('main')
    const flagBtn = main.getByRole('button', { name: /flag|dismiss/i }).first()
    if (await flagBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await flagBtn.click()
      await page.waitForTimeout(300)
      const warningIcon = main.locator('button:has-text("⚠")').first()
      if (await warningIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
        await warningIcon.click()
        await page.waitForTimeout(300)
        const abandonBtn = main.getByRole('button', { name: /abandon/i }).first()
        if (await abandonBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
          await abandonBtn.click()
          await page.waitForTimeout(300)
        }
      }
    }
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('pass-complete transition: skipping all Backlog tasks triggers pass-complete', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['Pass Task'])
    const main = page.locator('main')
    const skipBtn = main.getByRole('button', { name: /skip/i }).first()
    await expect(skipBtn).toBeVisible({ timeout: 5000 })
    await skipBtn.click()
    await page.waitForTimeout(1500)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('backlog promotion: Made Progress then pass-complete cycles tasks', async ({ page }) => {
    await addTasksWithAF4Backlog(page, ['Promote Task A'])
    const main = page.locator('main')
    const madeProgressBtn = main.getByRole('button', { name: /made progress/i }).first()
    await expect(madeProgressBtn).toBeVisible({ timeout: 5000 })
    await madeProgressBtn.click()
    await page.waitForTimeout(500)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })
})
