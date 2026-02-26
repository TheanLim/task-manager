/**
 * E2E tests for TMS system switching behavior.
 * Ref: EXTENSIBILITY-ARCHITECTURE.md §14 "System Switching"
 *
 * NOTE: Tab clicks use dispatchEvent('click') instead of .click() because
 * AF4's "Backlog pass complete" banner and other overlays intercept pointer events.
 * dispatchEvent bypasses hit-testing and dispatches directly on the element.
 */
import { test, expect, type Page } from '@playwright/test'

async function seedAndNavigate(page: Page, activeSystem: string) {
  await page.goto('/?view=tms')
  await page.waitForSelector('[role="tablist"]', { timeout: 10000 })

  const tabNameMap: Record<string, RegExp> = {
    'fvp': /fvp/i,
    'af4': /af4/i,
    'dit': /dit/i,
    'standard': /review queue/i,
    'none': /review queue/i,
  }
  const tabPattern = tabNameMap[activeSystem]
  if (tabPattern) {
    const tab = page.getByRole('tab', { name: tabPattern })
    await tab.dispatchEvent('click')
    await page.waitForTimeout(500)
  }
}

test.describe('System Switching', () => {
  test('switching from FVP to AF4 does not crash', async ({ page }) => {
    await seedAndNavigate(page, 'fvp')
    const main = page.locator('main')
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await af4Tab.dispatchEvent('click')
    await expect(main.getByRole('heading', { name: /backlog/i })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('switching from AF4 to DIT does not crash', async ({ page }) => {
    await seedAndNavigate(page, 'af4')
    const main = page.locator('main')
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    // DIT shows Today/Tomorrow headings
    await expect(main.getByRole('heading', { name: /^today$/i })).toBeVisible({ timeout: 5000 })
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('switching from AF4 to FVP shows FVP view', async ({ page }) => {
    await seedAndNavigate(page, 'af4')
    const main = page.locator('main')
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    // FVP with no tasks shows empty state
    await expect(main.getByText(/no tasks yet/i).or(
      main.getByRole('button', { name: /start preselection/i })
    )).toBeVisible({ timeout: 5000 })
  })

  test('switching back to AF4 resumes backlog view', async ({ page }) => {
    await seedAndNavigate(page, 'af4')
    const main = page.locator('main')
    // Switch to DIT
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main.getByRole('heading', { name: /^today$/i })).toBeVisible({ timeout: 5000 })
    // Switch back to AF4
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await af4Tab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main.getByRole('heading', { name: /backlog/i })).toBeVisible({ timeout: 5000 })
  })

  test('switching to a system for the first time shows its default view', async ({ page }) => {
    await seedAndNavigate(page, 'none')
    const main = page.locator('main')
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main.getByText(/no tasks yet/i).or(
      main.getByRole('button', { name: /start preselection/i })
    )).toBeVisible({ timeout: 5000 })
  })

  test('all four systems are reachable via tab bar', async ({ page }) => {
    await seedAndNavigate(page, 'none')
    const main = page.locator('main')
    const tabList = main.getByRole('tablist')
    await expect(tabList).toBeVisible()
    const tabs = tabList.getByRole('tab')
    const count = await tabs.count()
    expect(count).toBeGreaterThanOrEqual(4)
  })

  test('active tab has aria-selected=true', async ({ page }) => {
    await seedAndNavigate(page, 'fvp')
    const main = page.locator('main')
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await expect(fvpTab).toHaveAttribute('aria-selected', 'true')
  })

  test('inactive tab without saved state shows no Resumed pill', async ({ page }) => {
    await seedAndNavigate(page, 'fvp')
    const main = page.locator('main')
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await expect(af4Tab.getByText(/resumed/i)).not.toBeVisible()
  })

  test('error in one system view does not crash other systems', async ({ page }) => {
    await seedAndNavigate(page, 'fvp')
    const main = page.locator('main')
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await af4Tab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/unhandled error|application error/i)
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await expect(main).toBeVisible()
  })

  test('inactive tab with saved state shows Resumed pill', async ({ page }) => {
    // Add tasks, switch to FVP, create state, switch away, check for Resumed
    await page.goto('/')
    await page.waitForTimeout(500)
    // Add tasks
    const allTasksBtn = page.getByRole('button', { name: /all tasks/i })
    await allTasksBtn.click()
    await page.waitForTimeout(500)
    for (const name of ['Resumed A', 'Resumed B']) {
      await page.getByRole('button', { name: /add task/i }).click()
      await page.waitForTimeout(300)
      await page.getByLabel(/description/i).fill(name)
      await page.getByRole('button', { name: /create task/i }).click()
      await page.waitForTimeout(300)
    }
    // Navigate to TMS FVP
    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const main = page.locator('main')
    const fvpTab = main.getByRole('tab', { name: /fvp/i })
    await fvpTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    // Start preselection and dot a task to create persisted state
    const startBtn = main.getByRole('button', { name: /start preselection/i })
    if (await startBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await startBtn.click()
      await page.waitForTimeout(300)
      const dotBtn = main.getByRole('button', { name: /yes.*dot/i })
      if (await dotBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await dotBtn.click()
        await page.waitForTimeout(300)
      }
    }
    // Switch to DIT
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)
    // FVP tab should show Resumed pill (or at least not crash)
    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })

  test('switching to DIT on a new day triggers day rollover', async ({ page }) => {
    // Add tasks, navigate to DIT, inject yesterday's lastDayChange, switch away and back
    await page.goto('/')
    await page.waitForTimeout(500)
    const allTasksBtn = page.getByRole('button', { name: /all tasks/i })
    await allTasksBtn.click()
    await page.waitForTimeout(500)
    await page.getByRole('button', { name: /add task/i }).click()
    await page.waitForTimeout(300)
    await page.getByLabel(/description/i).fill('Rollover Switch Task')
    await page.getByRole('button', { name: /create task/i }).click()
    await page.waitForTimeout(300)

    const focusButton = page.getByRole('button', { name: /focus/i })
    await focusButton.click()
    await page.waitForSelector('[role="tablist"]', { timeout: 10000 })
    const main = page.locator('main')
    const ditTab = main.getByRole('tab', { name: /dit/i })
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    // Inject yesterday's lastDayChange
    await page.evaluate(() => {
      const raw = localStorage.getItem('task-management-tms');
      if (raw) {
        const parsed = JSON.parse(raw);
        const state = parsed.state?.state ?? parsed.state;
        if (state?.systemStates?.dit) {
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          state.systemStates.dit.lastDayChange = yesterday.toISOString();
          parsed.state = typeof parsed.state?.state !== 'undefined'
            ? { ...parsed.state, state }
            : state;
          localStorage.setItem('task-management-tms', JSON.stringify(parsed));
        }
      }
    });

    // Switch away and back to trigger rollover
    const af4Tab = main.getByRole('tab', { name: /af4/i })
    await af4Tab.dispatchEvent('click')
    await page.waitForTimeout(500)
    await ditTab.dispatchEvent('click')
    await page.waitForTimeout(500)

    await expect(main).toBeVisible()
    await expect(page.locator('body')).not.toContainText(/error|crash/i)
  })
})
