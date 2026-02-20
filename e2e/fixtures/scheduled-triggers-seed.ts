/**
 * Consolidated Scheduled Triggers Seed Data
 *
 * Merges Phase 5a, 5b, and 5c seed data into a single file.
 * Each phase has its own project to avoid test interference.
 * A single `seedDatabase(page)` function seeds ALL three projects at once.
 */
import type { Page } from '@playwright/test'

// ── Phase 5a IDs ────────────────────────────────────────────────────────

export const PHASE5A_PROJECT_ID = 'proj-5a-main'
export const PHASE5A_PROJECT_2_ID = 'proj-5a-secondary'

export const PHASE5A_SECTIONS = {
  backlog: `${PHASE5A_PROJECT_ID}-section-backlog`,
  todo: `${PHASE5A_PROJECT_ID}-section-todo`,
  inProgress: `${PHASE5A_PROJECT_ID}-section-in-progress`,
  review: `${PHASE5A_PROJECT_ID}-section-review`,
  done: `${PHASE5A_PROJECT_ID}-section-done`,
} as const

export const PHASE5A_SECTIONS_2 = {
  todo: `${PHASE5A_PROJECT_2_ID}-section-todo`,
  doing: `${PHASE5A_PROJECT_2_ID}-section-doing`,
  done: `${PHASE5A_PROJECT_2_ID}-section-done`,
} as const

// ── Phase 5b IDs ────────────────────────────────────────────────────────

export const PHASE5B_PROJECT_ID = 'proj-5b-main'

export const PHASE5B_SECTIONS = {
  backlog: `${PHASE5B_PROJECT_ID}-section-backlog`,
  todo: `${PHASE5B_PROJECT_ID}-section-todo`,
  inProgress: `${PHASE5B_PROJECT_ID}-section-in-progress`,
  done: `${PHASE5B_PROJECT_ID}-section-done`,
} as const

// ── Phase 5c IDs ────────────────────────────────────────────────────────

export const PHASE5C_PROJECT_ID = 'proj-5c-main'

export const PHASE5C_SECTIONS = {
  todo: `${PHASE5C_PROJECT_ID}-section-todo`,
  inProgress: `${PHASE5C_PROJECT_ID}-section-in-progress`,
  done: `${PHASE5C_PROJECT_ID}-section-done`,
} as const

// ── Shared Timestamps ───────────────────────────────────────────────────
// Dynamic timestamps relative to Date.now() ensure tests work regardless of run date.
// Fixed timestamps are only used for createdAt/updatedAt where the exact date doesn't affect rule evaluation.

const _now = Date.now()
const NOW_ISO = new Date(_now).toISOString()
const YESTERDAY = new Date(_now - 1 * 24 * 60 * 60 * 1000).toISOString()
const TWO_DAYS_AGO = new Date(_now - 2 * 24 * 60 * 60 * 1000).toISOString()
const THREE_DAYS_AGO = new Date(_now - 3 * 24 * 60 * 60 * 1000).toISOString()
const ONE_WEEK_AGO = new Date(_now - 7 * 24 * 60 * 60 * 1000).toISOString()
const TWO_WEEKS_AGO = new Date(_now - 14 * 24 * 60 * 60 * 1000).toISOString()
const ONE_HOUR_AGO = new Date(_now - 3_600_000).toISOString()
const FIVE_MIN_AGO = new Date(_now - 300_000).toISOString()
const TWO_HOURS_AGO = new Date(_now - 7_200_000).toISOString()
const ONE_HOUR_FROM_NOW = new Date(_now + 3_600_000).toISOString()

// ── Shared Helpers ──────────────────────────────────────────────────────

let taskCounter = 0
function makeTask(overrides: Record<string, unknown> = {}) {
  taskCounter++
  return {
    id: overrides.id ?? `task-${String(taskCounter).padStart(3, '0')}`,
    projectId: overrides.projectId ?? PHASE5A_PROJECT_ID,
    parentTaskId: overrides.parentTaskId ?? null,
    sectionId: overrides.sectionId ?? PHASE5A_SECTIONS.todo,
    description: overrides.description ?? `Task ${taskCounter}`,
    notes: overrides.notes ?? '',
    assignee: overrides.assignee ?? '',
    priority: overrides.priority ?? 'none',
    tags: overrides.tags ?? [],
    dueDate: overrides.dueDate ?? null,
    completed: overrides.completed ?? false,
    completedAt: overrides.completedAt ?? null,
    order: overrides.order ?? taskCounter,
    createdAt: (overrides.createdAt as string) ?? NOW_ISO,
    updatedAt: (overrides.updatedAt as string) ?? NOW_ISO,
    movedToSectionAt: (overrides.movedToSectionAt as string) ?? null,
  }
}

function makeRule(overrides: Record<string, unknown>) {
  return {
    id: overrides.id as string,
    projectId: (overrides.projectId as string) ?? PHASE5A_PROJECT_ID,
    name: overrides.name as string,
    trigger: overrides.trigger,
    filters: overrides.filters ?? [],
    action: overrides.action,
    enabled: overrides.enabled ?? true,
    brokenReason: overrides.brokenReason ?? null,
    executionCount: overrides.executionCount ?? 0,
    lastExecutedAt: overrides.lastExecutedAt ?? null,
    recentExecutions: overrides.recentExecutions ?? [],
    order: overrides.order ?? 0,
    bulkPausedAt: overrides.bulkPausedAt ?? null,
    createdAt: NOW_ISO,
    updatedAt: NOW_ISO,
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Phase 5a Data
// ═══════════════════════════════════════════════════════════════════════

const phase5aProjects = [
  {
    id: PHASE5A_PROJECT_ID,
    name: '🧪 Phase 5a Test Project',
    description: 'Primary project for testing all scheduled trigger features',
    viewMode: 'list', createdAt: NOW_ISO, updatedAt: NOW_ISO,
  },
  {
    id: PHASE5A_PROJECT_2_ID,
    name: '📦 Secondary Project',
    description: 'For cross-project and multi-project scheduler tests',
    viewMode: 'list', createdAt: NOW_ISO, updatedAt: NOW_ISO,
  },
]

const phase5aSections = [
  { id: PHASE5A_SECTIONS.backlog, projectId: PHASE5A_PROJECT_ID, name: 'Backlog', order: 0, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS.todo, projectId: PHASE5A_PROJECT_ID, name: 'To Do', order: 1, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS.inProgress, projectId: PHASE5A_PROJECT_ID, name: 'In Progress', order: 2, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS.review, projectId: PHASE5A_PROJECT_ID, name: 'Review', order: 3, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS.done, projectId: PHASE5A_PROJECT_ID, name: 'Done', order: 4, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS_2.todo, projectId: PHASE5A_PROJECT_2_ID, name: 'To Do', order: 0, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS_2.doing, projectId: PHASE5A_PROJECT_2_ID, name: 'Doing', order: 1, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5A_SECTIONS_2.done, projectId: PHASE5A_PROJECT_2_ID, name: 'Done', order: 2, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
]

const phase5aTasks = [
  makeTask({ id: 'task-5a-backlog-1', sectionId: PHASE5A_SECTIONS.backlog, description: 'Old spike: evaluate caching', priority: 'low', createdAt: TWO_DAYS_AGO }),
  makeTask({ id: 'task-5a-backlog-2', sectionId: PHASE5A_SECTIONS.backlog, description: 'Research logging framework', priority: 'none', createdAt: TWO_DAYS_AGO }),
  makeTask({ id: 'task-5a-due-today-1', sectionId: PHASE5A_SECTIONS.todo, description: 'Submit expense report', dueDate: '2026-02-19T17:00:00.000Z', priority: 'high' }),
  makeTask({ id: 'task-5a-due-today-2', sectionId: PHASE5A_SECTIONS.todo, description: 'Review PR #42', dueDate: '2026-02-19T12:00:00.000Z', priority: 'medium' }),
  makeTask({ id: 'task-5a-due-tomorrow', sectionId: PHASE5A_SECTIONS.todo, description: 'Prepare sprint demo', dueDate: '2026-02-20T10:00:00.000Z' }),
  makeTask({ id: 'task-5a-overdue-1', sectionId: PHASE5A_SECTIONS.todo, description: 'Fix flaky test (overdue)', dueDate: '2026-02-17T10:00:00.000Z', priority: 'high' }),
  makeTask({ id: 'task-5a-overdue-2', sectionId: PHASE5A_SECTIONS.todo, description: 'Update API docs (overdue)', dueDate: '2026-02-16T10:00:00.000Z' }),
  makeTask({ id: 'task-5a-no-due', sectionId: PHASE5A_SECTIONS.todo, description: 'Refactor auth module (no due date)' }),
  makeTask({ id: 'task-5a-ip-1', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Implement scheduler UI', priority: 'high', dueDate: '2026-02-21T10:00:00.000Z' }),
  makeTask({ id: 'task-5a-ip-2', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Write integration tests', priority: 'medium' }),
  makeTask({ id: 'task-5a-ip-3', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Design cron config panel', dueDate: '2026-02-19T18:00:00.000Z' }),
  makeTask({ id: 'task-5a-review-1', sectionId: PHASE5A_SECTIONS.review, description: 'Code review: scheduler service', priority: 'medium' }),
  makeTask({ id: 'task-5a-review-2', sectionId: PHASE5A_SECTIONS.review, description: 'QA sign-off: leader election', priority: 'low' }),
  makeTask({ id: 'task-5a-done-1', sectionId: PHASE5A_SECTIONS.done, description: 'Set up CI pipeline', completed: true, completedAt: ONE_HOUR_AGO }),
  makeTask({ id: 'task-5a-done-2', sectionId: PHASE5A_SECTIONS.done, description: 'Database schema design', completed: true, completedAt: YESTERDAY }),
  makeTask({ id: 'task-5a-done-3', sectionId: PHASE5A_SECTIONS.done, description: 'Initial project setup', completed: true, completedAt: TWO_DAYS_AGO }),
  makeTask({ id: 'task-5a-parent', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Epic: Scheduled Triggers', priority: 'high' }),
  makeTask({ id: 'task-5a-sub-1', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Subtask: Clock abstraction', parentTaskId: 'task-5a-parent' }),
  makeTask({ id: 'task-5a-sub-2', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Subtask: Schedule evaluator', parentTaskId: 'task-5a-parent' }),
  makeTask({ id: 'task-5a-sub-3', sectionId: PHASE5A_SECTIONS.inProgress, description: 'Subtask: Leader election', parentTaskId: 'task-5a-parent', completed: true, completedAt: ONE_HOUR_AGO }),
  makeTask({ id: 'task-5a-p2-1', projectId: PHASE5A_PROJECT_2_ID, sectionId: PHASE5A_SECTIONS_2.todo, description: 'Beta: setup monitoring', dueDate: '2026-02-19T15:00:00.000Z' }),
  makeTask({ id: 'task-5a-p2-2', projectId: PHASE5A_PROJECT_2_ID, sectionId: PHASE5A_SECTIONS_2.doing, description: 'Beta: deploy staging', priority: 'high' }),
  makeTask({ id: 'task-5a-p2-3', projectId: PHASE5A_PROJECT_2_ID, sectionId: PHASE5A_SECTIONS_2.done, description: 'Beta: write runbook', completed: true, completedAt: YESTERDAY }),
]

const phase5aRules = [
  makeRule({
    id: 'rule-5a-event-autocomplete', name: 'Auto-complete on Done',
    trigger: { type: 'card_moved_into_section', sectionId: PHASE5A_SECTIONS.done },
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 0,
  }),
  makeRule({
    id: 'rule-5a-interval-overdue', name: '⏱️ Move overdue → Review (every 30m)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 30 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_overdue' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5A_SECTIONS.review, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    executionCount: 3, lastExecutedAt: TWO_HOURS_AGO,
    recentExecutions: [{ timestamp: TWO_HOURS_AGO, triggerDescription: 'Scheduled (every 30 min)', actionDescription: 'Moved to Review', taskName: 'Fix flaky test (overdue)', matchCount: 2, details: ['Fix flaky test (overdue)', 'Update API docs (overdue)'], executionType: 'scheduled' }],
    order: 1,
  }),
  makeRule({
    id: 'rule-5a-cron-daily-standup', name: '📅 Daily standup card (9:00 AM)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] }, lastEvaluatedAt: YESTERDAY, catchUpPolicy: 'catch_up_latest' },
    action: { type: 'create_card', sectionId: PHASE5A_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Daily Standup', cardDateOption: 'today', specificMonth: null, specificDay: null, monthTarget: null },
    executionCount: 5, lastExecutedAt: YESTERDAY,
    recentExecutions: [
      { timestamp: YESTERDAY, triggerDescription: 'Cron (weekdays 9:00)', actionDescription: 'Created "Daily Standup"', taskName: 'Daily Standup', matchCount: 1, details: ['Daily Standup'], executionType: 'scheduled' },
      { timestamp: TWO_DAYS_AGO, triggerDescription: 'Cron (weekdays 9:00)', actionDescription: 'Created "Daily Standup"', taskName: 'Daily Standup', matchCount: 1, details: ['Daily Standup'], executionType: 'catch-up' },
    ],
    order: 2,
  }),
  makeRule({
    id: 'rule-5a-cron-weekly-review', name: '📅 Weekly review (Fri 4 PM)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 16, minute: 0, daysOfWeek: [5], daysOfMonth: [] }, lastEvaluatedAt: YESTERDAY, catchUpPolicy: 'catch_up_latest' },
    action: { type: 'create_card', sectionId: PHASE5A_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Weekly Review', cardDateOption: 'today', specificMonth: null, specificDay: null, monthTarget: null },
    order: 3,
  }),
  makeRule({
    id: 'rule-5a-cron-monthly-cleanup', name: '📅 Monthly cleanup (1st, 8 AM)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 8, minute: 0, daysOfWeek: [], daysOfMonth: [1] }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_complete' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5A_SECTIONS.done, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 4,
  }),
  makeRule({
    id: 'rule-5a-cron-last-day', name: '📅 End-of-month report (31st → last day)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 17, minute: 0, daysOfWeek: [], daysOfMonth: [31] }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    action: { type: 'create_card', sectionId: PHASE5A_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'End-of-Month Report', cardDateOption: 'last_day_of_month', specificMonth: null, specificDay: null, monthTarget: null },
    order: 5,
  }),
  makeRule({
    id: 'rule-5a-duerel-1day-before', name: '⏰ 1 day before due → In Progress',
    trigger: { type: 'scheduled_due_date_relative', sectionId: null, schedule: { kind: 'due_date_relative', offsetMinutes: -1440, displayUnit: 'days' }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_incomplete' }],
    action: { type: 'move_card_to_top_of_section', sectionId: PHASE5A_SECTIONS.inProgress, dateOption: null, position: 'top', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    executionCount: 1, lastExecutedAt: TWO_HOURS_AGO,
    recentExecutions: [{ timestamp: TWO_HOURS_AGO, triggerDescription: '1 day before due date', actionDescription: 'Moved to In Progress', taskName: 'Prepare sprint demo', matchCount: 1, details: ['Prepare sprint demo'], executionType: 'scheduled' }],
    order: 6,
  }),
  makeRule({
    id: 'rule-5a-duerel-1day-after', name: '⏰ 1 day after due → mark complete',
    trigger: { type: 'scheduled_due_date_relative', sectionId: null, schedule: { kind: 'due_date_relative', offsetMinutes: 1440, displayUnit: 'days' }, lastEvaluatedAt: TWO_DAYS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_incomplete' }, { type: 'is_overdue' }],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 7,
  }),
  makeRule({
    id: 'rule-5a-interval-set-due', name: '⏱️ No due date → set due tomorrow (hourly)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 60 }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'no_due_date' }, { type: 'is_incomplete' }],
    action: { type: 'set_due_date', sectionId: null, dateOption: 'tomorrow', position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 8,
  }),
  makeRule({
    id: 'rule-5a-disabled', name: '🚫 Disabled: archive old tasks (paused)',
    enabled: false,
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 120 }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_complete' }],
    action: { type: 'remove_due_date', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 9,
  }),
  makeRule({
    id: 'rule-5a-p2-interval', projectId: PHASE5A_PROJECT_2_ID, name: '⏱️ [Beta] Move overdue → Done (every 15m)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 15 }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_overdue' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5A_SECTIONS_2.done, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 0,
  }),
  makeRule({
    id: 'rule-5a-interval-5min', name: '⏱️ Quick check (every 5 min, minimum)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 5 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'has_due_date' }, { type: 'in_section', sectionId: PHASE5A_SECTIONS.todo }],
    action: { type: 'move_card_to_top_of_section', sectionId: PHASE5A_SECTIONS.inProgress, dateOption: null, position: 'top', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 10,
  }),
]

// ═══════════════════════════════════════════════════════════════════════
// Phase 5b Data
// ═══════════════════════════════════════════════════════════════════════

const phase5bProjects = [
  {
    id: PHASE5B_PROJECT_ID,
    name: '🔬 Phase 5b Test Project',
    description: 'Testing age-based filters, skip_missed, title templates, dry-run',
    viewMode: 'list', createdAt: NOW_ISO, updatedAt: NOW_ISO,
  },
]

const phase5bSections = [
  { id: PHASE5B_SECTIONS.backlog, projectId: PHASE5B_PROJECT_ID, name: 'Backlog', order: 0, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5B_SECTIONS.todo, projectId: PHASE5B_PROJECT_ID, name: 'To Do', order: 1, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5B_SECTIONS.inProgress, projectId: PHASE5B_PROJECT_ID, name: 'In Progress', order: 2, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5B_SECTIONS.done, projectId: PHASE5B_PROJECT_ID, name: 'Done', order: 3, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
]

const phase5bTasks = [
  makeTask({ id: 'task-5b-old-1', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.backlog, description: 'Ancient spike (2 weeks old)', createdAt: TWO_WEEKS_AGO, updatedAt: TWO_WEEKS_AGO }),
  makeTask({ id: 'task-5b-old-2', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.backlog, description: 'Stale research (1 week old)', createdAt: ONE_WEEK_AGO, updatedAt: ONE_WEEK_AGO }),
  makeTask({ id: 'task-5b-new-1', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.todo, description: 'Fresh task (today)', createdAt: NOW_ISO }),
  makeTask({ id: 'task-5b-new-2', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.todo, description: 'Yesterday task', createdAt: YESTERDAY }),
  makeTask({ id: 'task-5b-done-old', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.done, description: 'Done 2 weeks ago', completed: true, completedAt: TWO_WEEKS_AGO, createdAt: TWO_WEEKS_AGO }),
  makeTask({ id: 'task-5b-done-recent', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.done, description: 'Done yesterday', completed: true, completedAt: YESTERDAY, createdAt: THREE_DAYS_AGO }),
  makeTask({ id: 'task-5b-stale-1', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Untouched for a week', createdAt: ONE_WEEK_AGO, updatedAt: ONE_WEEK_AGO }),
  makeTask({ id: 'task-5b-stale-2', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Updated 3 days ago', createdAt: ONE_WEEK_AGO, updatedAt: THREE_DAYS_AGO }),
  makeTask({ id: 'task-5b-active', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Updated today', createdAt: THREE_DAYS_AGO, updatedAt: NOW_ISO }),
  makeTask({ id: 'task-5b-overdue-long', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.todo, description: 'Overdue by 2 weeks', dueDate: TWO_WEEKS_AGO }),
  makeTask({ id: 'task-5b-overdue-short', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.todo, description: 'Overdue by 1 day', dueDate: YESTERDAY }),
  makeTask({ id: 'task-5b-stuck-1', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Stuck in progress (1 week)', movedToSectionAt: ONE_WEEK_AGO, createdAt: TWO_WEEKS_AGO }),
  makeTask({ id: 'task-5b-stuck-2', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Just moved to progress', movedToSectionAt: NOW_ISO, createdAt: THREE_DAYS_AGO }),
  makeTask({ id: 'task-5b-ip-1', projectId: PHASE5B_PROJECT_ID, sectionId: PHASE5B_SECTIONS.inProgress, description: 'Regular in-progress task', dueDate: '2026-02-21T10:00:00.000Z' }),
]

const phase5bRules = [
  makeRule({
    id: 'rule-5b-created-old', projectId: PHASE5B_PROJECT_ID, name: '📅 Archive old backlog (created > 5 days)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 30 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'created_more_than', value: 5, unit: 'days' }, { type: 'in_section', sectionId: PHASE5B_SECTIONS.backlog }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5B_SECTIONS.done, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 0,
  }),
  makeRule({
    id: 'rule-5b-completed-old', projectId: PHASE5B_PROJECT_ID, name: '📅 Clean old completed (> 7 days)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 60 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'completed_more_than', value: 7, unit: 'days' }],
    action: { type: 'remove_due_date', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 1,
  }),
  makeRule({
    id: 'rule-5b-stale', projectId: PHASE5B_PROJECT_ID, name: '📅 Move stale tasks (not updated > 5 days)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 60 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'not_modified_in', value: 5, unit: 'days' }, { type: 'is_incomplete' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5B_SECTIONS.backlog, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 2,
  }),
  makeRule({
    id: 'rule-5b-overdue-escalate', projectId: PHASE5B_PROJECT_ID, name: '📅 Escalate overdue > 7 days → mark complete',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 60 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'overdue_by_more_than', value: 7, unit: 'days' }],
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 3,
  }),
  makeRule({
    id: 'rule-5b-stuck', projectId: PHASE5B_PROJECT_ID, name: '📅 Move stuck in progress (> 5 days)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 60 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'in_section_for_more_than', value: 5, unit: 'days' }, { type: 'in_section', sectionId: PHASE5B_SECTIONS.inProgress }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5B_SECTIONS.backlog, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 4,
  }),
  makeRule({
    id: 'rule-5b-skip-missed', projectId: PHASE5B_PROJECT_ID, name: '📅 Friday summary (skip if missed)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 16, minute: 0, daysOfWeek: [5], daysOfMonth: [] }, lastEvaluatedAt: ONE_WEEK_AGO, catchUpPolicy: 'skip_missed' },
    action: { type: 'create_card', sectionId: PHASE5B_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Friday Summary', cardDateOption: 'today', specificMonth: null, specificDay: null, monthTarget: null },
    executionCount: 2, lastExecutedAt: ONE_WEEK_AGO,
    recentExecutions: [{ timestamp: ONE_WEEK_AGO, triggerDescription: 'Cron (Fri 16:00)', actionDescription: 'Created "Friday Summary"', taskName: 'Friday Summary', matchCount: 1, details: ['Friday Summary'], executionType: 'scheduled' }],
    order: 5,
  }),
  makeRule({
    id: 'rule-5b-template', projectId: PHASE5B_PROJECT_ID, name: '📅 Daily standup with date template',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] }, lastEvaluatedAt: YESTERDAY, catchUpPolicy: 'catch_up_latest' },
    action: { type: 'create_card', sectionId: PHASE5B_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Standup — {{date}} ({{weekday}})', cardDateOption: 'today', specificMonth: null, specificDay: null, monthTarget: null },
    order: 6,
  }),
  makeRule({
    id: 'rule-5b-dryrun-target', projectId: PHASE5B_PROJECT_ID, name: '📅 Preview target: move overdue → Backlog',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 120 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_overdue' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5B_SECTIONS.backlog, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    order: 7,
  }),
]

// ═══════════════════════════════════════════════════════════════════════
// Phase 5c Data
// ═══════════════════════════════════════════════════════════════════════

const phase5cProjects = [{
  id: PHASE5C_PROJECT_ID,
  name: '⚡ Phase 5c Test Project',
  description: 'Testing bulk management and power-user features',
  viewMode: 'list', createdAt: NOW_ISO, updatedAt: NOW_ISO,
}]

const phase5cSections = [
  { id: PHASE5C_SECTIONS.todo, projectId: PHASE5C_PROJECT_ID, name: 'To Do', order: 0, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5C_SECTIONS.inProgress, projectId: PHASE5C_PROJECT_ID, name: 'In Progress', order: 1, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
  { id: PHASE5C_SECTIONS.done, projectId: PHASE5C_PROJECT_ID, name: 'Done', order: 2, collapsed: false, createdAt: NOW_ISO, updatedAt: NOW_ISO },
]

const phase5cTasks = [
  makeTask({ id: 'task-5c-1', projectId: PHASE5C_PROJECT_ID, sectionId: PHASE5C_SECTIONS.todo, description: 'Write docs', dueDate: YESTERDAY }),
  makeTask({ id: 'task-5c-2', projectId: PHASE5C_PROJECT_ID, sectionId: PHASE5C_SECTIONS.todo, description: 'Fix bug', priority: 'high' }),
  makeTask({ id: 'task-5c-3', projectId: PHASE5C_PROJECT_ID, sectionId: PHASE5C_SECTIONS.inProgress, description: 'Review PR' }),
  makeTask({ id: 'task-5c-4', projectId: PHASE5C_PROJECT_ID, sectionId: PHASE5C_SECTIONS.done, description: 'Deploy v1', completed: true, completedAt: YESTERDAY }),
]

const phase5cRules = [
  makeRule({
    id: 'rule-5c-event-1', projectId: PHASE5C_PROJECT_ID, name: 'Auto-complete on Done',
    trigger: { type: 'card_moved_into_section', sectionId: PHASE5C_SECTIONS.done },
    action: { type: 'mark_card_complete', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true, order: 0,
  }),
  makeRule({
    id: 'rule-5c-interval-1', projectId: PHASE5C_PROJECT_ID, name: '⏱️ Move overdue (every 30m)',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 30 }, lastEvaluatedAt: TWO_HOURS_AGO, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_overdue' }],
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5C_SECTIONS.inProgress, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true, order: 1,
  }),
  makeRule({
    id: 'rule-5c-cron-1', projectId: PHASE5C_PROJECT_ID, name: '📅 Daily standup (9 AM)',
    trigger: { type: 'scheduled_cron', sectionId: null, schedule: { kind: 'cron', hour: 9, minute: 0, daysOfWeek: [1, 2, 3, 4, 5], daysOfMonth: [] }, lastEvaluatedAt: YESTERDAY, catchUpPolicy: 'catch_up_latest' },
    action: { type: 'create_card', sectionId: PHASE5C_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Daily Standup', cardDateOption: 'today', specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true, order: 2,
  }),
  makeRule({
    id: 'rule-5c-disabled-1', projectId: PHASE5C_PROJECT_ID, name: '🚫 Paused: cleanup old tasks',
    trigger: { type: 'scheduled_interval', sectionId: null, schedule: { kind: 'interval', intervalMinutes: 120 }, lastEvaluatedAt: null, catchUpPolicy: 'catch_up_latest' },
    filters: [{ type: 'is_complete' }],
    action: { type: 'remove_due_date', sectionId: null, dateOption: null, position: null, cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: false, order: 3,
  }),
  makeRule({
    id: 'rule-5c-disabled-2', projectId: PHASE5C_PROJECT_ID, name: '🚫 Paused: auto-move on complete',
    trigger: { type: 'card_marked_complete', sectionId: null },
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5C_SECTIONS.done, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: false, order: 4,
  }),
  makeRule({
    id: 'rule-5c-onetime-past', projectId: PHASE5C_PROJECT_ID, name: '🔔 One-time catch-up test',
    trigger: { type: 'scheduled_one_time', sectionId: null, schedule: { kind: 'one_time', fireAt: ONE_HOUR_AGO }, lastEvaluatedAt: null },
    action: { type: 'move_card_to_bottom_of_section', sectionId: PHASE5C_SECTIONS.inProgress, dateOption: null, position: 'bottom', cardTitle: null, cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    filters: [{ type: 'is_overdue' }],
    enabled: true, order: 5,
  }),
  makeRule({
    id: 'rule-5c-onetime-future', projectId: PHASE5C_PROJECT_ID, name: '⏳ One-time future trigger',
    trigger: { type: 'scheduled_one_time', sectionId: null, schedule: { kind: 'one_time', fireAt: ONE_HOUR_FROM_NOW }, lastEvaluatedAt: null },
    action: { type: 'create_card', sectionId: PHASE5C_SECTIONS.todo, dateOption: null, position: 'top', cardTitle: 'Future one-time card', cardDateOption: null, specificMonth: null, specificDay: null, monthTarget: null },
    enabled: true, order: 6,
  }),
]

// ═══════════════════════════════════════════════════════════════════════
// Combined Data & Seed Function
// ═══════════════════════════════════════════════════════════════════════

const allProjects = [...phase5aProjects, ...phase5bProjects, ...phase5cProjects]
const allSections = [...phase5aSections, ...phase5bSections, ...phase5cSections]
const allTasks = [...phase5aTasks, ...phase5bTasks, ...phase5cTasks]
const allRules = [...phase5aRules, ...phase5bRules, ...phase5cRules]

const dataStorePayload = {
  state: { projects: allProjects, tasks: allTasks, sections: allSections, dependencies: [] },
  version: 1,
}

const appStorePayload = {
  state: {
    settings: { activeProjectId: PHASE5A_PROJECT_ID, timeManagementSystem: 'none', showOnlyActionableTasks: false, theme: 'system' },
    projectTabs: {}, globalTasksDisplayMode: 'nested',
    columnOrder: ['dueDate', 'priority', 'assignee', 'tags'],
    sortColumn: null, sortDirection: 'asc', needsAttentionSort: false,
    hideCompletedTasks: false, autoHideThreshold: '24h', showRecentlyCompleted: false, keyboardShortcuts: {},
  },
  version: 1,
}

/**
 * Seeds localStorage with ALL three phases' data at once.
 * Each phase has its own project, so tests don't interfere.
 */
export async function seedDatabase(page: Page) {
  await page.goto('/')
  await page.evaluate(
    ([dataJson, appJson, automationsJson]) => {
      localStorage.setItem('task-management-data', dataJson)
      localStorage.setItem('task-management-settings', appJson)
      localStorage.setItem('task-management-automations', automationsJson)
    },
    [
      JSON.stringify(dataStorePayload),
      JSON.stringify(appStorePayload),
      JSON.stringify(allRules),
    ] as const,
  )
  await page.reload()
}
