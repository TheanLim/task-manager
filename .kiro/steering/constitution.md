# Task Management App

Next.js static-export task manager with feature-based architecture, Zustand state, Zod-validated entities, and a domain event–driven automation engine.

## Tech Stack

- **Language:** TypeScript 5.x (strict mode)
- **Framework:** Next.js 15 (static export, `output: 'export'`)
- **State:** Zustand 4.5 with `persist` middleware
- **Styling:** Tailwind CSS 3.4 + shadcn/ui (Radix primitives) + `next-themes` (dark mode)
- **Validation:** Zod 4.x — schemas are the single source of truth for entity types
- **Testing:** vitest 2.x (unit, jsdom) + Playwright 1.x (e2e)
- **DnD:** @dnd-kit (core + sortable)
- **Rich Text:** react-quill-new
- **Compression:** LZMA (share URLs)
- **Icons:** lucide-react

## Code Quality Standards

- Always use TypeScript strict mode — `strict: true` in tsconfig, no `any` in production code (relaxed in tests via ESLint override)
- Always validate at runtime with Zod — entity schemas in `lib/schemas.ts` are the canonical type source; `types/index.ts` re-exports inferred types
- Always use the repository pattern for data access — never read/write localStorage directly from components or hooks
- Always run `vitest run` before claiming work is done — coverage thresholds enforced (80% lines/functions/branches/statements)
- Prefer Zustand selectors over full store subscriptions — `useDataStore(s => s.tasks)` not `useDataStore()`
- Feature isolation — each feature owns its components, hooks, services, repositories, and types; cross-feature imports go through barrel `index.ts`

## Project Structure

```
app/                    # Next.js app router — layout, page, global CSS, app-level hooks
components/             # Shared UI: Layout, Breadcrumb, ErrorBoundary, ThemeProvider
  ui/                   # shadcn/ui primitives (button, dialog, select, etc.)
features/               # Feature modules (self-contained)
  automations/          # Rule engine: triggers, filters, actions, scheduler, preview
  keyboard/             # Grid nav, shortcuts, customization
  projects/             # Project CRUD, sections, views
  sharing/              # URL sharing (LZMA), JSON import/export, dedup
  tasks/                # Task CRUD, hierarchy, dependencies, sorting, filtering
  tms/                  # Time management strategies (DIT, AF4, FVP)
lib/                    # Domain infrastructure
  events/               # Domain event pub/sub (emitDomainEvent, subscribeToDomainEvents)
  repositories/         # Generic Repository<T> interface + localStorage implementations
  schemas.ts            # Zod schemas — canonical entity definitions
  serviceContainer.ts   # Composition root — all singletons wired here
  validation.ts         # Input validation (user-facing fields)
stores/                 # Top-level Zustand stores
  dataStore.ts          # Entity cache + CRUD actions (delegates to services/repos)
  appStore.ts           # UI preferences (theme, sort, columns, shortcuts)
types/                  # Re-exports Zod-inferred types + enums
e2e/                    # Playwright e2e tests
```

## Build & Run

```bash
npm run dev              # Next.js dev server (localhost:3000)
npm run build            # Static export to out/
npm run lint             # ESLint (next/core-web-vitals + typescript)
npm run test:run         # vitest single run (use this, not watch mode)
npm run test:coverage    # vitest with v8 coverage
npm run test:e2e         # Playwright e2e (headless)
npm run test:e2e:headed  # Playwright e2e (headed browser)
npm run lint:tailwind    # Check Tailwind content config
```

## Architecture Overview

### Composition Root & Dependency Injection

`lib/serviceContainer.ts` is the single wiring point. All repositories and services are instantiated here as singletons. Components never construct services — they import singletons from `serviceContainer` (or via `dataStore` re-exports).

```
serviceContainer.ts
├── LocalStorageBackend          (unified persistence + Zod validation on load)
├── Repositories                 (thin CRUD over backend)
│   ├── ProjectRepository, TaskRepository, SectionRepository, DependencyRepository
│   └── AutomationRuleRepository (own localStorage key)
├── Services                     (business logic, cascade ops)
│   ├── TaskService, ProjectService, SectionService, DependencyService
│   └── AutomationService + RuleExecutor + SchedulerService
└── events/                      (domain event pub/sub)
```

### Data Flow: Write Path

```
Component → dataStore.updateTask(id, updates)
  → captures previousValues from repo
  → taskRepository.update(id, updates)
    → LocalStorageBackend writes to 4 localStorage keys (unified + 3 Zustand)
    → notifies listeners
  → repo subscription → useDataStore.setState({ tasks })
  → emitDomainEvent() wrapped in beginBatch()/endBatch()
    → automationService.handleEvent()
      → evaluateRules() → ruleExecutor.executeActions()
        → may cascade (up to depth 5)
```

### Data Flow: Read Path

```
App loads → LocalStorageBackend constructor
  → try unified key → AppStateSchema.safeParse()
  → fallback: assemble from 3 Zustand persist keys
  → if all fail → empty default state
```

### Repository Pattern

| Interface | Implementation | Storage Key |
|-----------|---------------|-------------|
| `Repository<T>` | `LocalStorageProjectRepository` | `task-management-app-state` (unified) |
| `Repository<T>` | `LocalStorageTaskRepository` | + `task-management-data` (Zustand) |
| `Repository<T>` | `LocalStorageSectionRepository` | + `task-management-settings` |
| `Repository<T>` | `LocalStorageDependencyRepository` | + `task-management-tms` |
| `AutomationRuleRepository` | `LocalStorageAutomationRuleRepository` | `task-management-automations` (independent) |

**Critical:** AutomationRuleRepository uses its own key — `LocalStorageBackend.reset()` does NOT clear automation rules. Import/export must handle rules separately.

### Domain Events

Cross-cutting pub/sub in `lib/events/`. Events emitted by `dataStore` mutations, consumed by `automationService`.

| Event Type | Emitted When |
|-----------|-------------|
| `task.created` | `addTask()` |
| `task.updated` | `updateTask()` |
| `task.deleted` | `deleteTask()` |
| `section.created` | `addSection()` |
| `section.updated` | `updateSection()` |
| `schedule.fired` | Scheduler tick matches a scheduled rule |

Every mutation that triggers automations MUST be wrapped in `beginBatch()`/`endBatch()` for aggregated toasts.

### Zustand Stores

| Store | Key | Purpose |
|-------|-----|---------|
| `dataStore` | `task-management-data` | Entity cache (projects, tasks, sections, deps, rules) + CRUD actions |
| `appStore` | `task-management-settings` | UI prefs (theme, sort, columns, shortcuts, display modes) |
| `tmsStore` | `task-management-tms` | TMS metadata (DIT/AF4/FVP state) — in `features/tms/stores/` |
| `filterStore` | (transient) | Search/filter state — in `features/tasks/stores/` |
| `keyboardNavStore` | (transient) | Focused task + active cell — in `features/keyboard/stores/` |

### Adding a New Feature

1. Create `features/{name}/` with `index.ts` (barrel), `README.md`, `components/`
2. Add `types.ts` and `schemas.ts` if the feature has validated entities
3. Add `services/`, `hooks/`, `stores/`, `repositories/` only when needed
4. Cross-feature imports go through barrel exports (`@/features/X`)
5. Entity construction MUST use service factory methods, not inline `new Date()` / `uuidv4()`
6. If persisted, add Zod schema to `lib/schemas.ts`, wire repo in `serviceContainer.ts`, add to `dataStore`

## Key Conventions

### File Organization

- One component per file, co-located tests (`Component.tsx` + `Component.test.tsx`)
- Feature barrel exports in `index.ts` — public API only
- No loose `.ts` files at feature root except `index.ts`, `types.ts`, `schemas.ts`
- Services are pure functions or classes with constructor-injected dependencies
- Hooks in `hooks/`, stores in `stores/`, repositories in `repositories/`

### Naming

| Entity | Convention | Example |
|--------|-----------|---------|
| Components | PascalCase | `TaskDetailPanel.tsx` |
| Hooks | camelCase, `use` prefix | `useFilteredTasks.ts` |
| Services | camelCase | `taskService.ts`, `ruleEngine.ts` |
| Stores | camelCase, `Store` suffix | `dataStore.ts`, `filterStore.ts` |
| Types/Schemas | PascalCase types, camelCase files | `Task` in `schemas.ts` |
| Test files | `.test.ts` / `.test.tsx` suffix | `taskService.test.ts` |
| Feature dirs | kebab-case | `features/automations/` |
| Barrel exports | `index.ts` | `features/tasks/index.ts` |

### Path Aliases

`@/*` maps to project root — use `@/lib/schemas`, `@/features/tasks`, `@/stores/dataStore`.

### Zod Schema Conventions

- Entity IDs use `.string().min(1)` — NOT `.uuid()` (section IDs and seed data use non-UUID formats)
- Schemas live in `lib/schemas.ts` (core entities) or `features/{name}/schemas.ts` (feature-specific)
- TypeScript types are inferred from schemas: `type Task = z.infer<typeof TaskSchema>`
- `types/index.ts` re-exports all canonical types

### UI Component Conventions

- shadcn/ui primitives in `components/ui/` — Radix-based, Tailwind-styled
- Dark mode via `next-themes` + Tailwind `darkMode: ["class"]`
- Toast notifications via `sonner`
- Icons from `lucide-react`
- CSS variables for theme colors (HSL format in `globals.css`)

## Automations

Rule-based "if this, then that" engine scoped to projects. Event triggers fire on domain events; scheduled triggers fire on timers (interval, cron, one-time, due-date-relative). Filters are optional AND-logic conditions. Actions mutate tasks/sections. Cascades up to depth 5 with dedup (`ruleId:entityId:actionType`). Subtasks excluded by design.

| Layer | Key Files |
|-------|-----------|
| Orchestrator | `services/automationService.ts` |
| Evaluation (pure) | `services/evaluation/ruleEngine.ts`, `filterPredicates.ts` |
| Execution (Strategy) | `services/execution/actionHandlers.ts`, `ruleExecutor.ts` |
| Scheduler | `services/scheduler/schedulerService.ts`, `scheduleEvaluator.ts`, leader election |
| Preview | `services/preview/rulePreviewService.ts`, `ruleMetadata.ts` |
| Rules lifecycle | `services/rules/brokenRuleDetector.ts`, `ruleFactory.ts`, `dryRunService.ts` |
| UI | `components/wizard/RuleDialog.tsx`, `components/AutomationTab.tsx` |

See `features/automations/README.md`, `ARCHITECTURE.md`, `EXTENDING.md` for full docs.

## Tasks

Core CRUD with hierarchy (parent/subtask), dependencies (blocking/blocked with circular check), sorting, filtering, and 3 view modes (list, board, calendar). TaskService owns cascade delete/complete and entity factories.

| Component | Purpose |
|-----------|---------|
| `TaskList.tsx` | Table view — sections, drag-drop, column sort/resize/reorder, keyboard nav |
| `TaskBoard.tsx` | Kanban board — drag-drop between sections via @dnd-kit |
| `TaskCalendar.tsx` | Calendar view by due date |
| `TaskDetailPanel.tsx` | Side panel for editing all task fields |
| `taskService.ts` | Cascade delete, cascade complete, reinsert, entity factories |
| `taskSortService.ts` | Pure sorting functions |
| `dependencyResolver.ts` | `isTaskBlocked`, `hasCircularDependency` |
| `filterStore.ts` | Transient search/filter state |

See `features/tasks/README.md`, `DECISIONS.md` for full docs.

## Projects

Project CRUD with sections and tabbed views (Overview, List, Board, Calendar, Automations). ProjectService creates with 3 default sections ("To Do", "Doing", "Done"). Cascade delete removes: automation rules → tasks → subtasks → dependencies → sections → project.

See `features/projects/README.md` for full docs.

## Sharing

Export/import via LZMA-compressed URLs (`#share=<base64url>`) and JSON files. Replace and merge workflows. Deduplication is pure (`deduplicateEntities()`). Automation rules imported separately via `ShareService.importAutomationRules()`.

See `features/sharing/README.md` for full docs.

## Time Management Systems (TMS)

Pluggable task-ordering strategies via handler interface (`initialize`, `getOrderedTasks`, `onTaskCreated`, `onTaskCompleted`).

| System | Enum | Core Idea |
|--------|------|-----------|
| Standard | `NONE` | Sort by `task.order` |
| Do It Tomorrow | `DIT` | Today → Tomorrow → Unscheduled (day rollover) |
| Autofocus 4 | `AF4` | Marked (in mark-order) → Unmarked |
| Final Version Perfected | `FVP` | Pairwise comparison scan, dotted (reversed) → undotted |

See `features/tms/README.md` for full docs.

## Keyboard Navigation

Grid-based nav with 21 shortcut actions (16 customizable). `computeVisibleRows()` flattens task tree respecting section collapse + subtask expansion. `moveActiveCell()` is pure. Vim h/j/k/l as secondary aliases. `gg` chord (300ms). Shortcuts persisted as partial overrides merged with defaults at read time.

See `features/keyboard/README.md` for full docs.

## Cross-Feature Dependencies

```
projects → tasks, automations, sharing
tasks    → automations (SectionContextMenuItem), keyboard
sharing  → automations (optional repo for rule import/export), tms (export state)
```

Domain events (`lib/events/`) are the primary decoupling mechanism. See `CROSS-FEATURE-GUIDE.md` for change checklists and fragile integration points.

## Custom Agents

Specialized agents in `.kiro/agents/`. **Invoke agents proactively.**

### Automatic Triggers (MUST invoke if condition matches)

| If you are touching OR researching... | Invoke Agent |
|---------------------------------------|--------------|
| Creating a new specialized agent | `agent-factory` |
| Creating or updating the project constitution | `constitution-factory` |
| Creating a new `.kiro/context/` document | `context-factory` |
| Automation rules, triggers, filters, actions, scheduler, cascade execution, rule engine | `automations-engineer` |

### Quick Reference

| Agent | Model | Primary Focus |
|-------|-------|---------------|
| `agent-factory` | sonnet | Creates new specialized agents with domain knowledge and project registration |
| `constitution-factory` | sonnet | Creates/updates the project constitution steering file |
| `context-factory` | sonnet | Creates `.kiro/context/` system blueprint documents with MCP registration |
| `automations-engineer` | opus | Domain expert for the automations rule engine — triggers, filters, actions, cascade, scheduler, preview |

## Context7 MCP Server

Use context7 MCP tools FIRST when exploring unfamiliar code.

| Tool | Use For |
|------|---------|
| `list_subsystems()` | See all subsystems |
| `get_files_for_subsystem("{name}")` | Get key files for a subsystem |
| `find_relevant_context("{task}")` | Find files for a task |
| `search_context_documents("{keyword}")` | Search architecture docs |
| `suggest_agent("{task}")` | Get recommended agent |

### Subsystem Reference

| Key | Description | Key Files |
|-----|-------------|-----------|
| `core-infrastructure` | Persistence, validation, events, service wiring | `lib/serviceContainer.ts`, `lib/schemas.ts`, `lib/repositories/` |
| `stores` | Zustand state management (data + app + feature stores) | `stores/dataStore.ts`, `stores/appStore.ts` |
| `automations` | Rule engine, scheduler, evaluation, execution | `features/automations/services/`, `features/automations/schemas.ts` |
| `tasks` | Task CRUD, hierarchy, dependencies, sorting, views | `features/tasks/components/`, `features/tasks/services/` |
| `projects` | Project CRUD, sections, cascade operations | `features/projects/components/`, `features/projects/services/` |
| `sharing` | URL sharing, JSON import/export, deduplication | `features/sharing/services/`, `features/sharing/components/` |
| `tms` | Time management strategies (DIT, AF4, FVP) | `features/tms/handlers/`, `features/tms/stores/tmsStore.ts` |
| `keyboard` | Grid navigation, shortcuts, customization | `features/keyboard/services/`, `features/keyboard/stores/` |
| `ui-shared` | Shared components, shadcn/ui primitives, layout | `components/`, `components/ui/`, `app/layout.tsx` |
| `e2e-tests` | Playwright end-to-end test suite | `e2e/` |

## Infrastructure Governance

### Post-Feature Checklist

After structural changes (new systems, new event types, changed patterns):

- [ ] **Tests** — Run `npm run test:run` and verify all pass
- [ ] **Build** — Run `npm run build` to catch type errors vitest misses
- [ ] **Context Docs** — Update feature `README.md` / `DECISIONS.md` if you changed how a subsystem works
- [ ] **Constitution** — Update `.kiro/steering/constitution.md` if you added/removed systems, services, or conventions
- [ ] **MCP server** — Update `mcp-server/server.py` SUBSYSTEMS if you added/renamed/deleted source files
- [ ] **Cross-Feature Guide** — Update `CROSS-FEATURE-GUIDE.md` if you changed service interfaces or event types
- [ ] **Agents** — Update `.kiro/agents/{agent-id}.md` only if the agent's workflow changed

Skip docs for: bug fixes, value tweaks, CSS changes, adding items using existing patterns.

### New Agent Checklist

1. Create `.kiro/agents/{agent-id}.md`
2. Add to constitution Automatic Triggers table
3. Add to constitution Quick Reference table
4. Add to MCP server AGENTS registry
(Use `agent-factory` to automate this.)

### New Context Doc Checklist

1. Create `.kiro/context/{topic}.md`
2. Add to MCP server SUBSYSTEMS dict
3. Add bidirectional cross-references to related feature docs
4. Update constitution only if introducing a genuinely new subsystem
(Use `context-factory` to automate this.)

### Drift Detection

User-triggered hook (`.kiro/hooks/drift-detection.kiro.hook`) that runs `.kiro/scripts/context-drift-check.py` via `askAgent`. The agent dynamically chooses script arguments (`--commits N`, `--since DAYS`, `--verbose`) based on user context, executes the script, summarizes results, and suggests which context docs need updating.

The Python script scans recent git commits, matches changed files to MCP SUBSYSTEMS, and flags subsystems where code changed but context docs didn't. Priority tiers: HIGH (core-infrastructure, automations, stores) → auto-warn; MEDIUM → mention; LOW → suppressed.

```bash
# The hook runs these dynamically, but you can also run manually:
python3 .kiro/scripts/context-drift-check.py              # defaults: 20 commits, 7 days
python3 .kiro/scripts/context-drift-check.py --commits 50 --since 14 --verbose
```

## Key Files Reference

| Area | Files |
|------|-------|
| Entry point | `app/page.tsx`, `app/layout.tsx` |
| Global CSS | `app/globals.css`, `app/quill-custom.css` |
| Composition root | `lib/serviceContainer.ts` |
| Zod schemas | `lib/schemas.ts`, `features/automations/schemas.ts`, `features/keyboard/schemas.ts` |
| Type definitions | `types/index.ts` |
| Domain events | `lib/events/domainEvents.ts`, `lib/events/types.ts` |
| Repository interfaces | `lib/repositories/types.ts` |
| Repository impls | `lib/repositories/localStorageBackend.ts`, `lib/repositories/localStorageRepositories.ts` |
| Stores | `stores/dataStore.ts`, `stores/appStore.ts` |
| Feature stores | `features/tms/stores/tmsStore.ts`, `features/tasks/stores/filterStore.ts`, `features/keyboard/stores/keyboardNavStore.ts` |
| Cross-feature guide | `CROSS-FEATURE-GUIDE.md` |
| Feature inventory | `features/README.md` |
| Build config | `package.json`, `tsconfig.json`, `next.config.js`, `vitest.config.ts`, `playwright.config.ts`, `tailwind.config.ts` |
| E2E tests | `e2e/*.spec.ts` |
| Agents | `.kiro/agents/agent-factory.md`, `.kiro/agents/constitution-factory.md`, `.kiro/agents/context-factory.md`, `.kiro/agents/automations-engineer.md` |
| Hooks | `.kiro/hooks/drift-detection.kiro.hook` |
| Scripts | `.kiro/scripts/context-drift-check.py` |

## Known Fragile Points

1. **Zustand persist + LocalStorageBackend dual-write** — Both write to same localStorage keys. Backend is source of truth; Zustand stores are caches synced via repo subscriptions.
2. **AutomationRuleRepository independent storage** — Own key `task-management-automations`, not managed by `LocalStorageBackend.reset()`. Import/export must handle separately.
3. **Entity IDs are NOT UUIDs** — Section IDs use format `${projectId}-section-todo`. Zod schemas use `.min(1)` not `.uuid()`.
4. **beginBatch/endBatch required** — Every domain event emission in dataStore MUST be wrapped for aggregated toasts.
5. **Subtask exclusion in automations** — `evaluateRules` skips events where `parentTaskId` is non-null. By design.
