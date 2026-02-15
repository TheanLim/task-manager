import { z } from 'zod';

// Enum schemas
export const PrioritySchema = z.enum(['none', 'low', 'medium', 'high']);
export const ViewModeSchema = z.enum(['list', 'board', 'calendar']);
export const TimeManagementSystemSchema = z.enum(['none', 'dit', 'af4', 'fvp']);

// Entity schemas
export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string(),
  viewMode: ViewModeSchema,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  color: z.string().optional(),
  icon: z.string().optional(),
});

export const TaskSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid().nullable(),
  parentTaskId: z.string().uuid().nullable(),
  sectionId: z.string().nullable(),
  description: z.string().min(1).max(500),
  notes: z.string(),
  assignee: z.string(),
  priority: PrioritySchema,
  tags: z.array(z.string()),
  dueDate: z.string().datetime().nullable(),
  completed: z.boolean(),
  completedAt: z.string().datetime().nullable(),
  order: z.number(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastActionAt: z.string().datetime().nullable().optional(),
  comments: z.array(z.any()).optional(),
  attachments: z.array(z.any()).optional(),
  customFields: z.record(z.string(), z.any()).optional(),
});

export const SectionSchema = z.object({
  id: z.string(), // Not uuid — current code generates IDs like `${projectId}-section-todo`
  projectId: z.string().nullable(),
  name: z.string().min(1).max(100),
  order: z.number(),
  collapsed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const TaskDependencySchema = z.object({
  id: z.string().uuid(),
  blockingTaskId: z.string().uuid(),
  blockedTaskId: z.string().uuid(),
  createdAt: z.string().datetime(),
});

// Composite schemas
export const TMSStateSchema = z.object({
  activeSystem: TimeManagementSystemSchema,
  dit: z.object({
    todayTasks: z.array(z.string()),
    tomorrowTasks: z.array(z.string()),
    lastDayChange: z.string().datetime(),
  }),
  af4: z.object({
    markedTasks: z.array(z.string()),
    markedOrder: z.array(z.string()),
  }),
  fvp: z.object({
    dottedTasks: z.array(z.string()),
    currentX: z.string().nullable(),
    selectionInProgress: z.boolean(),
  }),
});

export const AppSettingsSchema = z.object({
  activeProjectId: z.string().uuid().nullable(),
  timeManagementSystem: TimeManagementSystemSchema,
  showOnlyActionableTasks: z.boolean(),
  theme: z.enum(['light', 'dark', 'system']),
  notifications: z.boolean().optional(),
  defaultPriority: PrioritySchema.optional(),
});

export const AppStateSchema = z.object({
  projects: z.array(ProjectSchema),
  tasks: z.array(TaskSchema),
  sections: z.array(SectionSchema),
  dependencies: z.array(TaskDependencySchema),
  tmsState: TMSStateSchema,
  settings: AppSettingsSchema,
  version: z.string(),
});

// Derive TypeScript types from Zod schemas
export type Project = z.infer<typeof ProjectSchema>;
export type Task = z.infer<typeof TaskSchema>;
export type Section = z.infer<typeof SectionSchema>;
export type TaskDependency = z.infer<typeof TaskDependencySchema>;
export type TMSState = z.infer<typeof TMSStateSchema>;
export type AppSettings = z.infer<typeof AppSettingsSchema>;
export type AppState = z.infer<typeof AppStateSchema>;
