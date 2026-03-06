<!-- v1 | last-verified: 2026-03-05 -->
# E2E Test Suite

Playwright end-to-end test suite with 273 tests across 15 spec files covering all major features. Tests use localStorage seeding to inject realistic data before page load, avoiding slow UI-based setup. Chromium-only, fully parallel, with HTML reporter.

## Overview

The suite validates user-facing behavior across projects, tasks, automations, keyboard navigation, sharing, and views. Two seed fixtures provide pre-built datasets: `seed-data.ts` (general purpose, 2 projects, 14 tasks, 2 rules) and `scheduled-triggers-seed.ts` (3 phased projects with 30+ tasks and 20+ scheduled rules). Tests run against `localhost:3000` with the dev server auto-started by Playwright.

## Configuration

| Setting | Value | Notes |
|---------|-------|-------|
| Test dir | `./e2e` | All spec files at root level |
| Browser | Chromium only | `devices['Desktop Chrome']` |
| Parallel | `fullyParallel: true` | CI uses 1 worker |
| Retries | 0 local, 2 CI | `process.env.CI` toggle |
| Base URL | `http://localhost:3000` | Overridable via `BASE_URL` env |
| Trace | `on-first-retry` | Captures trace on failure |
| Screenshots | `only-on-failure` | Auto-captured |
| Reporter | `html` | Opens with `npx playwright show-report` |
| Web server | `npm run dev` | Auto-started, 120s timeout, reuses existing |

## Seed Data Architecture

Tests inject data directly into localStorage before navigation, bypassing UI setup entirely.

### Seeding Pattern

```typescript
// In test:
test.beforeEach(async ({ page }) => {
  await seedDatabase(page)           // Injects localStorage
  await page.goto('/?project=...')   // App hydrates from seeded data
})
```

### Seed Fixtures

| Fixture | File | Projects | Tasks | Rules | Purpose |
|---------|------|----------|-------|-------|---------|
| General | `fixtures/seed-data.ts` | 2 | 14 | 2 | Core CRUD, views, keyboard, sharing |
| Scheduled | `fixtures/scheduled-triggers-seed.ts` | 5 (3 phases) | 30+ | 20+ | Scheduler, age filters, bulk ops |

### General Seed Data (`seed-data.ts`)

Exports stable IDs for deterministic assertions:

| Export | Value | Used By |
|--------|-------|---------|
| `PROJECT_ID` | `proj-seed-001` | Most seeded tests |
| `PROJECT_2_ID` | `proj-seed-002` | Multi-project tests |
| `SECTION_IDS` | `{todo, doing, done}` | Section-scoped assertions |
| `TASK_IDS` | 14 stable IDs | Task-specific assertions |
| `RULE_IDS` | `{autoComplete, autoMove}` | Automation tests |

Key task variants seeded: basic, with due date, high priority, with tags, parent/subtask hierarchy, unlinked (no project), aged completed (past 24h threshold).

### localStorage Keys Seeded

| Key | Content |
|-----|---------|
| `task-management-data` | `{state: {projects, tasks, sections, dependencies}, version: 1}` |
| `task-management-settings` | `{state: {settings, projectTabs, ...}, version: 1}` |
| `task-management-automations` | Array of automation rule objects |

### Scheduled Triggers Seed (`scheduled-triggers-seed.ts`)

Uses dynamic timestamps relative to `Date.now()` so tests work regardless of run date. Three isolated phases:

| Phase | Project ID | Focus |
|-------|-----------|-------|
| 5a | `proj-5a-main` + `proj-5a-secondary` | Core scheduled triggers (interval, cron, due-date-relative) |
| 5b | `proj-5b-main` | Age filters, skip_missed policy, title templates, dry-run |
| 5c | `proj-5c-main` | Bulk disable/enable, power-user features |

Critical: `scheduled-triggers.spec.ts` uses `waitForSchedulerCatchUp()` — polls localStorage until a rule's `lastEvaluatedAt` is within 30s of now, with configurable timeout (default 15s).

## Spec File Coverage

| Spec File | Tests | Feature Area | Seeded? |
|-----------|-------|-------------|---------|
| `keyboard-shortcuts.spec.ts` | 66 | Grid nav, vim keys, CRUD via keyboard, help overlay, settings | Yes |
| `scheduled-triggers.spec.ts` | 71 | Scheduler tick, interval/cron/due-date triggers, run now, wizard, bulk ops | Yes (scheduled) |
| `global-automations-phase2.spec.ts` | 28 | Global rule scope, execution log, CRUD, amber badge | Yes |
| `subtask-nav-and-settings.spec.ts` | 23 | Subtask-aware j/k nav, expand/collapse, shortcut customization | Yes |
| `all-tasks-controls.spec.ts` | 19 | Completed threshold, review queue, nested/flat toggle, reinsert | Yes |
| `seeded-views.spec.ts` | 16 | List/board/calendar views with seeded data | Yes |
| `automation-rules.spec.ts` | 12 | Section context menu, rule dialog, execution toast, max rules | Yes |
| `global-automations.spec.ts` | 12 | Sidebar nav, global panel, project tab integration, execution | Yes |
| `global-tasks.spec.ts` | 5 | Global tasks view, task creation from global context | Yes |
| `seeded-global-tasks.spec.ts` | 4 | Global view with seeded data, project column, nested/flat | Yes |
| `project-management.spec.ts` | 4 | Project CRUD, dialog, tabs | No (fresh) |
| `task-management.spec.ts` | 4 | Task CRUD, dialog fields | No (fresh) |
| `task-views.spec.ts` | 4 | Board/calendar view switching | No (fresh) |
| `app-layout.spec.ts` | 4 | Header, sidebar toggle, theme, project list | No (fresh) |
| `share-dialog.spec.ts` | 1 | Share dialog stays open after menu click | Yes |

## Test Patterns

### Fresh vs. Seeded Tests

- **Fresh tests** (no seed): `app-layout`, `project-management`, `task-management`, `task-views` — test from empty state, create data via UI
- **Seeded tests** (all others): Call `seedDatabase(page)` in `beforeEach`, navigate via URL params

### URL-Based Navigation

Tests navigate directly to specific views using query params:
```
/?project={PROJECT_ID}&tab=list     → Project list view
/?project={PROJECT_ID}&tab=board    → Project board view
/?project={PROJECT_ID}&tab=calendar → Project calendar view
/?project={PROJECT_ID}&tab=automations → Project automations tab
/?view=tasks                        → Global tasks view
/?view=automations                  → Global automations panel
/?view=automations&tab=log&outcome=skipped → Pre-filtered log
```

### Keyboard Test Helpers

`keyboard-shortcuts.spec.ts` and `subtask-nav-and-settings.spec.ts` share a `focusTaskRow()` helper:
1. Finds the row by task text
2. Clicks the first `<td>` at a specific position (avoids checkbox/chevron)
3. Escapes any accidental inline edit
4. Focuses the table
5. Asserts `tr[data-kb-active="true"]` contains the expected text

### Automation Seeding Helpers

`automation-rules.spec.ts` provides:
- `generateRules(projectId, sectionId, count)` — bulk-generates rule objects for max-rules testing
- `seedWithCustomRules(page, rulesJson)` — replaces default rules in localStorage

`global-automations.spec.ts` and `global-automations-phase2.spec.ts` provide:
- `seedGlobalRule(page, rule)` — appends a global rule to existing localStorage rules
- `makeGlobalRule(overrides)` — factory for global rule objects with `projectId: null`
- `makeSkipEntry()` / `makeFireEntry()` — factories for execution log entries

### Scheduler Test Helpers

`scheduled-triggers.spec.ts` provides:
- `waitForSchedulerCatchUp(page, ruleId, timeout)` — polls localStorage for `lastEvaluatedAt` update
- `getStoredRules(page)` / `getStoredTasks(page)` — read localStorage state from browser context
- `ruleCard(page, nameSubstring)` — locates a rule card by name substring

### Serial Mode

`global-automations-phase2.spec.ts` uses `test.describe.configure({ mode: 'serial' })` because the Next.js dev server shares module state across parallel workers.

## Key Locator Patterns

| Element | Locator Strategy |
|---------|-----------------|
| Task row | `tr[data-task-id]` or `tr[data-task-id="${id}"]` |
| Active keyboard row | `tr[data-kb-active="true"]` |
| Section options | `button[title="Section options"]` |
| Inline edit | `[contenteditable="true"][role="textbox"]` |
| Detail panel | `.animate-slide-in-right` |
| Rule card | `div[role="button"]` with `h3` containing name |
| Completion toggle | `button[aria-label="Mark as complete"]` / `Mark as incomplete` |
| Expand subtasks | `button[aria-label="Expand subtasks"]` |
| Collapse subtasks | `button[aria-label="Collapse subtasks"]` |
| Table grid | `table[role="grid"]` |

## Feature Coverage Map

| Feature | Spec Files | Key Scenarios |
|---------|-----------|---------------|
| Project CRUD | `project-management`, `seeded-views` | Create, dialog, tabs, sidebar |
| Task CRUD | `task-management`, `keyboard-shortcuts` | Create, edit, delete, complete |
| List view | `seeded-views`, `keyboard-shortcuts` | Sections, priority badges, tags, due dates |
| Board view | `seeded-views`, `task-views` | Columns, task counts, add buttons |
| Calendar view | `seeded-views`, `task-views` | Month nav, day headers, due date placement |
| Keyboard nav | `keyboard-shortcuts`, `subtask-nav-and-settings` | j/k/G/gg, section skip, subtask-aware |
| Shortcut customization | `subtask-nav-and-settings` | Edit shortcuts, recording, reset defaults |
| Automations (event) | `automation-rules` | Section menu, rule dialog, toast, undo, max rules |
| Automations (scheduled) | `scheduled-triggers` | Interval, cron, due-date-relative, catch-up, run now |
| Automations (global) | `global-automations`, `global-automations-phase2` | Scope, execution log, CRUD, amber badge |
| Global tasks | `global-tasks`, `seeded-global-tasks` | View, creation, project column, nested/flat |
| Completed controls | `all-tasks-controls` | Threshold dropdown, always hide, show all, review queue |
| Sharing | `share-dialog` | Share dialog persistence |
| Layout | `app-layout` | Header, sidebar toggle, theme |
| Subtask hierarchy | `subtask-nav-and-settings`, `seeded-views` | Expand/collapse, nav through subtasks |

## Running Tests

```bash
npm run test:e2e              # Headless (default)
npm run test:e2e:headed       # Headed browser (debugging)
npx playwright test --ui      # Interactive UI mode
npx playwright test e2e/keyboard-shortcuts.spec.ts  # Single file
npx playwright test -g "j and k navigate"           # By test name
npx playwright show-report    # View HTML report
```

Critical: Dev server must be running or Playwright auto-starts it (120s timeout). For faster iteration, start `npm run dev` separately.

## Testing Conventions

1. **Stable IDs over dynamic queries** — seed data uses deterministic IDs (`task-todo-001`, `proj-seed-001`) for reliable assertions
2. **URL params for navigation** — avoid clicking through sidebar; go directly to `/?project=X&tab=Y`
3. **`waitForTimeout` sparingly** — used for animation settling (100-500ms), scheduler catch-up uses polling instead
4. **Explicit timeouts on expects** — `toBeVisible({ timeout: 10000 })` for initial page loads, shorter for subsequent assertions
5. **Force clicks for hidden menus** — `{ force: true }` on dropdown triggers that may be partially obscured
6. **Escape inline edit** — keyboard tests always check for and escape accidental `contenteditable` activation
7. **localStorage assertions** — scheduler tests read localStorage directly via `page.evaluate()` rather than relying on UI state

## Key Files

| File | Description |
|------|-------------|
| `playwright.config.ts` | Playwright configuration |
| `e2e/fixtures/seed-data.ts` | General-purpose seed fixture |
| `e2e/fixtures/scheduled-triggers-seed.ts` | Scheduled triggers seed (3 phases) |
| `e2e/keyboard-shortcuts.spec.ts` | Keyboard navigation tests (66) |
| `e2e/scheduled-triggers.spec.ts` | Scheduled trigger tests (71) |
| `e2e/automation-rules.spec.ts` | Event automation tests (12) |
| `e2e/global-automations.spec.ts` | Global automations phase 1 (12) |
| `e2e/global-automations-phase2.spec.ts` | Global automations phase 2 (28) |
| `e2e/subtask-nav-and-settings.spec.ts` | Subtask nav + shortcut settings (23) |
| `e2e/all-tasks-controls.spec.ts` | Completed controls + review queue (19) |
| `e2e/seeded-views.spec.ts` | List/board/calendar with seed data (16) |
| `e2e/global-tasks.spec.ts` | Global tasks view (5) |
| `e2e/seeded-global-tasks.spec.ts` | Seeded global tasks (4) |
| `e2e/project-management.spec.ts` | Project CRUD (4) |
| `e2e/task-management.spec.ts` | Task CRUD (4) |
| `e2e/task-views.spec.ts` | View switching (4) |
| `e2e/app-layout.spec.ts` | Layout structure (4) |
| `e2e/share-dialog.spec.ts` | Share dialog (1) |

## References

### Source Files
- `playwright.config.ts` — Playwright configuration
- `e2e/fixtures/seed-data.ts` — General seed data with stable IDs
- `e2e/fixtures/scheduled-triggers-seed.ts` — Phased scheduler seed data
- `e2e/*.spec.ts` — 15 spec files, 273 total tests

### Related Context Docs
- [automations.md](automations.md) — Automation engine architecture (tested by `automation-rules`, `scheduled-triggers`, `global-automations*`)
- [keyboard.md](keyboard.md) — Keyboard navigation system (tested by `keyboard-shortcuts`, `subtask-nav-and-settings`)
- [stores.md](stores.md) — Zustand stores (seeded via localStorage in fixtures)
- [core-infrastructure.md](core-infrastructure.md) — Persistence layer (localStorage keys used by seed fixtures)
- [ui-shared.md](ui-shared.md) — Shared UI components (tested by `app-layout`)
