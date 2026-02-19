# Task Management Web App

A modern, feature-rich task management application with integrated time management methodologies. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Project Management
- Create, edit, and delete projects
- Multiple projects with independent task lists
- Project descriptions and metadata
- Shareable project URLs via query parameters
- Three view modes per project: List, Board, and Calendar

### Task Management
- Create, edit, and delete tasks with rich text descriptions (Quill editor)
- Priority levels (None, Low, Medium, High)
- Due dates with calendar picker
- Tags, assignee tracking, and notes
- Subtasks with unlimited nesting
- Task dependencies (blocking/blocked by)
- Section-based organization

### Global Tasks View
- View and manage tasks across all projects in one place
- Filter and search across the entire task set
- **Review Queue mode** — sort by last reviewed (oldest first), mark tasks reviewed with ↻ button to push them to the bottom
- **Completed task management** — popover with hide-all toggle, configurable auto-hide threshold (24h / 48h / 1 week / Never), and "Recently done" view for referencing completed work
- Nested (hierarchical) or Flat (all tasks at same level) display modes
- Subtask progress counts (e.g. 3/5) on parent tasks across all views
- Drag-and-drop reordering (disabled in Review Queue mode)
- Project column with drag-reorderable columns

### Automation Rules
- "If this, then that" rules scoped to projects
- Triggers: card moved, completed, created, section events
- Actions: move card, mark complete/incomplete, set/remove due date, create card
- Filters: section membership, date ranges, overdue status
- Cascade execution with loop protection (max depth 5)
- Undo support (10-second window)

### Time Management Systems
Four methodologies to choose from:

1. **Standard Mode** — Traditional task list with manual organization
2. **DIT (Do It Tomorrow)** — Tasks split into Today / Tomorrow with automatic rollover
3. **AF4 (Autofocus 4)** — Mark tasks to focus on, work through them in order
4. **FVP (Final Version Perfected)** — Pairwise comparison to build a prioritized list

### Sharing & Data Management
- Share project state via compressed, URL-safe links (LZMA compression)
- Import shared state with data integrity validation
- Export/import data as JSON (merge or replace modes)
- Data deduplication on merge imports
- Automatic localStorage persistence with per-entity repository layer
- Cross-tab synchronization
- Zod-based schema validation

### Keyboard Navigation
- Full keyboard navigation for task lists with vim-style shortcuts
- Arrow keys and hjkl for movement
- gg / G for first/last row, Ctrl+d / Ctrl+u for half-page scroll
- [ / ] for section jumping
- Space to toggle completion, Enter to open details
- Subtask-aware navigation (respects expanded/collapsed state)
- Customizable shortcuts via help overlay (press ?)

### User Interface
- Responsive design (mobile, tablet, desktop)
- Dark / Light / System theme support
- Collapsible sidebar
- Inline-editable fields
- Task detail panel
- Drag-and-drop (dnd-kit) in Board and DIT views
- Error boundary for graceful error handling

## Tech Stack

- **Framework**: Next.js 15 (App Router, static export)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand with persistence
- **Rich Text**: react-quill-new
- **Drag & Drop**: dnd-kit
- **Validation**: Zod
- **Date Handling**: date-fns, react-day-picker
- **Compression**: LZMA (for share links)
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library + fast-check (unit), Playwright (e2e)

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm

### Installation

```bash
git clone <repository-url>
cd task-manager
npm install
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Building for Production

```bash
npm run build
```

Static files are generated in the `out/` directory.

### Running Tests

```bash
# Unit tests (single run)
npm run test:run

# Unit tests (watch mode)
npm run test:watch

# Unit tests with coverage
npm run test:coverage

# E2E tests
npm run test:e2e

# E2E tests (headed browser)
npm run test:e2e:headed

# E2E tests (interactive UI)
npm run test:e2e:ui
```

## Project Structure

```
├── app/                              # Next.js app directory
│   ├── page.tsx                      # Main application page (app shell)
│   ├── layout.tsx                    # Root layout with providers
│   ├── hooks/                        # App-shell hooks
│   │   ├── useDialogManager.ts       # Dialog/panel/toast orchestration
│   │   └── useCrossTabSync.ts        # localStorage cross-tab sync
│   ├── globals.css
│   └── quill-custom.css
│
├── components/                       # Shared UI components
│   ├── ui/                           # shadcn/ui primitives (Button, Dialog, etc.)
│   ├── Layout.tsx                    # Main layout shell (sidebar + content)
│   ├── ErrorBoundary.tsx             # Error handling wrapper
│   ├── EmptyState.tsx                # Reusable empty state display
│   ├── InlineEditable.tsx            # Inline editing component
│   ├── ThemeProvider.tsx / ThemeToggle.tsx
│   └── _unused/                      # Inactive components (FilterPanel, SearchBar, ViewModeSelector)
│
├── features/                         # Feature modules (see features/README.md)
│   ├── automations/                  # Rule-based automation engine
│   │   ├── components/               # AutomationTab, RuleDialog, RuleCard, etc.
│   │   ├── hooks/                    # useAutomationRules, useUndoAutomation
│   │   ├── services/                 # automationService, ruleEngine, ruleExecutor, etc.
│   │   ├── repositories/             # LocalStorageAutomationRuleRepository
│   │   ├── events.ts                 # Re-exports from lib/events (backward compat)
│   │   ├── schemas.ts / types.ts
│   │   └── index.ts                  # Barrel export
│   │
│   ├── keyboard/                     # Keyboard navigation & shortcuts
│   │   ├── components/               # ShortcutHelpOverlay, ShortcutSettings
│   │   ├── hooks/                    # useGlobalShortcuts, useKeyboardNavigation
│   │   ├── services/                 # gridNavigationService, shortcutService
│   │   ├── stores/                   # keyboardNavStore
│   │   ├── schemas.ts / types.ts
│   │   └── index.ts
│   │
│   ├── projects/                     # Project & section management
│   │   ├── components/               # ProjectDialog, ProjectList, ProjectView, SectionManager
│   │   ├── services/                 # projectService, sectionService
│   │   └── index.ts
│   │
│   ├── sharing/                      # Import/export, URL sharing, deduplication
│   │   ├── components/               # ShareButton, SharedStateDialog, ImportExportMenu
│   │   ├── hooks/                    # useSharedStateLoader
│   │   ├── services/                 # shareService, importExport, deduplicateData
│   │   ├── types/                    # lzma.d.ts
│   │   └── index.ts
│   │
│   ├── tasks/                        # Task CRUD, views, filtering, dependencies
│   │   ├── components/               # TaskList, TaskBoard, TaskCalendar, TaskRow,
│   │   │                             # TaskDetailPanel, TaskDialog, DependencyDialog,
│   │   │                             # GlobalTasksView, GlobalTasksHeader, GlobalTasksContainer,
│   │   │                             # RichTextEditor
│   │   ├── hooks/                    # useFilteredTasks
│   │   ├── services/                 # taskService, dependencyService, dependencyResolver,
│   │   │                             # autoHideService, taskSortService
│   │   ├── stores/                   # filterStore
│   │   └── index.ts
│   │
│   └── tms/                          # Time management strategies (DIT, AF4, FVP)
│       ├── components/               # TMSSelector, DITView, AF4View, FVPView
│       ├── handlers/                 # Pure strategy handlers per methodology
│       ├── stores/                   # tmsStore
│       └── index.ts
│
├── lib/                              # Domain infrastructure (no UI code)
│   ├── events/                       # Cross-cutting domain event pub/sub
│   │   ├── domainEvents.ts           # emitDomainEvent, subscribeToDomainEvents
│   │   ├── types.ts                  # DomainEvent interface
│   │   └── index.ts
│   ├── repositories/                 # Per-entity localStorage repositories
│   │   ├── localStorageBackend.ts    # Unified persistence + Zod validation
│   │   ├── localStorageRepositories.ts
│   │   └── types.ts                  # Repository<T> interface + entity-specific interfaces
│   ├── serviceContainer.ts           # Composition root (DI wiring)
│   ├── schemas.ts                    # Zod schemas (source of truth for entity types)
│   ├── validation.ts                 # Input validation (ValidationError)
│   └── utils.ts                      # cn() classnames helper
│
├── stores/                           # Global Zustand stores
│   ├── dataStore.ts                  # Entity cache + CRUD actions + repo subscriptions
│   └── appStore.ts                   # UI preferences (theme, sort, columns, shortcuts)
│
├── types/                            # TypeScript type definitions
│   └── index.ts                      # Enums (Priority, ViewMode, TMS) + re-exports from schemas
│
├── e2e/                              # Playwright end-to-end tests
└── public/                           # Static assets (lzma_worker.js)
```

## Architecture

See [features/README.md](features/README.md) for the feature module conventions and cross-feature dependency map.

### Key Architectural Patterns

- **Feature-based modules** — Each feature owns its components, services, hooks, and types behind a barrel export (`index.ts`)
- **Service layer** — Business logic lives in services, not stores or components
- **Repository pattern** — Per-entity CRUD interfaces backed by `LocalStorageBackend`
- **Domain events** — Cross-cutting pub/sub in `lib/events/` decouples features (automations subscribe to task/section mutations)
- **Composition root** — `lib/serviceContainer.ts` wires all repositories and services as singletons
- **Zod at the boundary** — Schema validation on localStorage load and data import

### Cross-Feature Integration Guide

See [CROSS-FEATURE-GUIDE.md](CROSS-FEATURE-GUIDE.md) for the dependency map, integration points, and "if you change X, also update Y" checklist.

## Data Storage

All data is stored locally in the browser's localStorage. No data is sent to any server. Use the Export feature to back up your data.

## Deployment

### Static Export (GitHub Pages, Netlify, S3, etc.)

```bash
npm run build
# Deploy the out/ directory
```

### Vercel

Connect the repository — Vercel auto-detects Next.js and deploys with default settings.

## Acknowledgments

- Time management methodologies by Mark Forster (DIT, AF4, FVP)
- UI components: shadcn/ui
- Icons: Lucide React
