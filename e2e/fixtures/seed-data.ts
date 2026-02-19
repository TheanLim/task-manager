/**
 * Seed data for e2e tests.
 *
 * Provides a realistic dataset that can be injected into localStorage
 * before page load, skipping UI-based setup entirely.
 *
 * Usage in a test:
 *   import { seedDatabase, PROJECT_ID, SECTION_IDS } from './fixtures/seed-data'
 *   test.beforeEach(async ({ page }) => {
 *     await seedDatabase(page)
 *     await page.goto('/')
 *   })
 */
import type { Page } from '@playwright/test'

// ── Stable IDs ──────────────────────────────────────────────────────────────
export const PROJECT_ID = 'proj-seed-001'
export const PROJECT_2_ID = 'proj-seed-002'

export const SECTION_IDS = {
  todo: `${PROJECT_ID}-section-todo`,
  doing: `${PROJECT_ID}-section-doing`,
  done: `${PROJECT_ID}-section-done`,
} as const

export const SECTION_2_IDS = {
  todo: `${PROJECT_2_ID}-section-todo`,
  doing: `${PROJECT_2_ID}-section-doing`,
  done: `${PROJECT_2_ID}-section-done`,
} as const

export const RULE_IDS = {
  autoComplete: 'rule-auto-complete',
  autoMove: 'rule-auto-move',
} as const

export const TASK_IDS = {
  todoTask1: 'task-todo-001',
  todoTask2: 'task-todo-002',
  doingTask1: 'task-doing-001',
  doneTask1: 'task-done-001',
  withDueDate: 'task-due-001',
  withDueDateFuture: 'task-due-002',
  highPriority: 'task-pri-high',
  withTags: 'task-tags-001',
  parentTask: 'task-parent-001',
  subtask1: 'task-sub-001',
  subtask2: 'task-sub-002',
  unlinkedTask: 'task-unlinked-001',
  project2Task: 'task-p2-001',
} as const

const NOW = '2026-02-14T10:00:00.000Z'
const RECENT_COMPLETED = new Date(Date.now() - 3600_000).toISOString() // 1 hour ago — always within 24h auto-hide window

// ── Projects ────────────────────────────────────────────────────────────────
const projects = [
  {
    id: PROJECT_ID,
    name: 'Seed Project Alpha',
    description: 'Primary test project with varied task data',
    viewMode: 'list',
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: PROJECT_2_ID,
    name: 'Seed Project Beta',
    description: 'Secondary project for multi-project tests',
    viewMode: 'list',
    createdAt: NOW,
    updatedAt: NOW,
  },
]

// ── Sections ────────────────────────────────────────────────────────────────
const sections = [
  // Project Alpha sections
  { id: SECTION_IDS.todo, projectId: PROJECT_ID, name: 'To Do', order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW },
  { id: SECTION_IDS.doing, projectId: PROJECT_ID, name: 'Doing', order: 1, collapsed: false, createdAt: NOW, updatedAt: NOW },
  { id: SECTION_IDS.done, projectId: PROJECT_ID, name: 'Done', order: 2, collapsed: false, createdAt: NOW, updatedAt: NOW },
  // Project Beta sections
  { id: SECTION_2_IDS.todo, projectId: PROJECT_2_ID, name: 'To Do', order: 0, collapsed: false, createdAt: NOW, updatedAt: NOW },
  { id: SECTION_2_IDS.doing, projectId: PROJECT_2_ID, name: 'Doing', order: 1, collapsed: false, createdAt: NOW, updatedAt: NOW },
  { id: SECTION_2_IDS.done, projectId: PROJECT_2_ID, name: 'Done', order: 2, collapsed: false, createdAt: NOW, updatedAt: NOW },
]

// ── Helper ──────────────────────────────────────────────────────────────────
function makeTask(overrides: Partial<{
  id: string; projectId: string | null; parentTaskId: string | null;
  sectionId: string | null; description: string; notes: string;
  assignee: string; priority: string; tags: string[];
  dueDate: string | null; completed: boolean; completedAt: string | null;
  order: number;
}>) {
  return {
    id: overrides.id ?? 'task-default',
    projectId: overrides.projectId ?? PROJECT_ID,
    parentTaskId: overrides.parentTaskId ?? null,
    sectionId: overrides.sectionId ?? SECTION_IDS.todo,
    description: overrides.description ?? 'Untitled task',
    notes: overrides.notes ?? '',
    assignee: overrides.assignee ?? '',
    priority: overrides.priority ?? 'none',
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate ?? null,
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    order: overrides.order ?? 0,
    createdAt: NOW,
    updatedAt: NOW,
  }
}

// ── Tasks ───────────────────────────────────────────────────────────────────
const tasks = [
  // To Do section — two basic tasks
  makeTask({ id: TASK_IDS.todoTask1, description: 'Set up CI pipeline', order: 0 }),
  makeTask({ id: TASK_IDS.todoTask2, description: 'Write unit tests', order: 1 }),

  // Doing section — one in-progress task
  makeTask({ id: TASK_IDS.doingTask1, sectionId: SECTION_IDS.doing, description: 'Implement auth flow', order: 0 }),

  // Done section — one completed task
  makeTask({ id: TASK_IDS.doneTask1, sectionId: SECTION_IDS.done, description: 'Design database schema', completed: true, completedAt: RECENT_COMPLETED, order: 0 }),

  // Task with due date (today)
  makeTask({ id: TASK_IDS.withDueDate, description: 'Review PR by today', dueDate: '2026-02-14T12:00:00.000Z', order: 2 }),

  // Task with future due date
  makeTask({ id: TASK_IDS.withDueDateFuture, description: 'Prepare demo', dueDate: '2026-02-20T12:00:00.000Z', sectionId: SECTION_IDS.doing, order: 1 }),

  // High priority task
  makeTask({ id: TASK_IDS.highPriority, description: 'Fix critical bug', priority: 'high', order: 3 }),

  // Task with tags
  makeTask({ id: TASK_IDS.withTags, description: 'Update documentation', tags: ['docs', 'frontend'], order: 4 }),

  // Parent task with subtasks
  makeTask({ id: TASK_IDS.parentTask, description: 'Refactor components', sectionId: SECTION_IDS.doing, order: 2 }),
  makeTask({ id: TASK_IDS.subtask1, parentTaskId: TASK_IDS.parentTask, sectionId: SECTION_IDS.doing, description: 'Extract shared hooks', order: 0 }),
  makeTask({ id: TASK_IDS.subtask2, parentTaskId: TASK_IDS.parentTask, sectionId: SECTION_IDS.doing, description: 'Update imports', order: 1 }),

  // Unlinked task (no project)
  makeTask({ id: TASK_IDS.unlinkedTask, projectId: null, sectionId: null, description: 'Personal reminder', order: 0 }),

  // Task in second project
  makeTask({ id: TASK_IDS.project2Task, projectId: PROJECT_2_ID, sectionId: SECTION_2_IDS.todo, description: 'Beta project kickoff', order: 0 }),
]

// ── Automation Rules ─────────────────────────────────────────────────────────
const automationRules = [
  {
    id: RULE_IDS.autoComplete,
    projectId: PROJECT_ID,
    name: 'Auto-complete',
    trigger: { type: 'card_moved_into_section', sectionId: SECTION_IDS.done },
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
    order: 0,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: RULE_IDS.autoMove,
    projectId: PROJECT_ID,
    name: 'Auto-move',
    trigger: { type: 'card_marked_complete', sectionId: null },
    filters: [],
    action: {
      type: 'move_card_to_bottom_of_section',
      sectionId: SECTION_IDS.done,
      dateOption: null,
      position: 'bottom',
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
    order: 1,
    createdAt: NOW,
    updatedAt: NOW,
  },
]

// ── Zustand localStorage payloads ───────────────────────────────────────────
const dataStorePayload = {
  state: { projects, tasks, sections, dependencies: [] },
  version: 1,
}

const appStorePayload = {
  state: {
    settings: {
      activeProjectId: null,
      timeManagementSystem: 'none',
      showOnlyActionableTasks: false,
      theme: 'system',
    },
    projectTabs: {},
    globalTasksDisplayMode: 'nested',
    columnOrder: ['dueDate', 'priority', 'assignee', 'tags'],
    sortColumn: null,
    sortDirection: 'asc',
    needsAttentionSort: false,
    hideCompletedTasks: false,
    autoHideThreshold: '24h',
    showRecentlyCompleted: false,
    keyboardShortcuts: {},
  },
  version: 1,
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Seeds localStorage with test data BEFORE navigating to the app.
 * Must be called before `page.goto('/')`.
 *
 * Optionally accepts overrides for the app settings payload.
 */
export async function seedDatabase(
  page: Page,
  settingsOverrides?: Record<string, unknown>,
) {
  const appPayload = settingsOverrides
    ? { ...appStorePayload, state: { ...appStorePayload.state, ...settingsOverrides } }
    : appStorePayload

  // Navigate to a blank page first so we can set localStorage on the correct origin
  await page.goto('/')
  await page.evaluate(
    ([dataJson, appJson, automationsJson]) => {
      localStorage.setItem('task-management-data', dataJson)
      localStorage.setItem('task-management-settings', appJson)
      localStorage.setItem('task-management-automations', automationsJson)
    },
    [JSON.stringify(dataStorePayload), JSON.stringify(appPayload), JSON.stringify(automationRules)] as const,
  )
  // Reload so the app picks up the seeded data
  await page.reload()
}
