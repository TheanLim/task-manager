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

### Time Management Systems
Four methodologies to choose from:

1. **Standard Mode** — Traditional task list with manual organization
2. **DIT (Do It Tomorrow)** — Tasks split into Today / Tomorrow with automatic rollover
3. **AF4 (Autofocus 4)** — Mark tasks to focus on, work through them in order
4. **FVP (Final Version Perfected)** — Pairwise comparison to build a prioritized list

### Sharing
- Share project state via compressed, URL-safe links (LZMA compression)
- Import shared state with data integrity validation

### Data Management
- Automatic localStorage persistence with per-entity repository layer
- Cross-tab synchronization
- Export/import data as JSON (merge or replace)
- Zod-based schema validation
- Data deduplication utilities

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
├── app/                          # Next.js app directory
│   ├── page.tsx                  # Main application page
│   ├── layout.tsx                # Root layout with providers
│   ├── globals.css               # Global styles
│   └── quill-custom.css          # Rich text editor styles
├── components/                   # Shared UI components
│   ├── ui/                       # shadcn/ui primitives
│   ├── Layout.tsx                # Main layout shell
│   ├── ErrorBoundary.tsx         # Error handling
│   ├── FilterPanel.tsx           # Search & filter controls
│   ├── GlobalTasksContainer.tsx  # Cross-project task view
│   ├── GlobalTasksHeader.tsx
│   ├── GlobalTasksView.tsx
│   ├── ImportExportMenu.tsx      # Data import/export
│   ├── InlineEditable.tsx        # Inline editing component
│   ├── RichTextEditor.tsx        # Quill wrapper
│   ├── SearchBar.tsx
│   ├── ThemeProvider.tsx
│   ├── ThemeToggle.tsx
│   └── ViewModeSelector.tsx
├── features/                     # Feature modules
│   ├── projects/
│   │   ├── components/           # ProjectDialog, ProjectList, ProjectView, etc.
│   │   └── services/             # projectService (CRUD, business logic)
│   ├── tasks/
│   │   ├── components/           # TaskBoard, TaskCalendar, TaskDialog, TaskList, TaskRow, etc.
│   │   ├── hooks/                # useFilteredTasks
│   │   ├── services/             # taskService, dependencyService, autoHideService
│   │   └── dependencyResolver.ts
│   ├── tms/
│   │   ├── components/           # AF4View, DITView, FVPView, TMSSelector
│   │   ├── handlers/             # AF4Handler, DITHandler, FVPHandler, StandardHandler
│   │   └── stores/               # tmsStore
│   └── sharing/
│       ├── components/           # ShareButton, SharedStateDialog
│       ├── hooks/                # useSharedStateLoader
│       └── services/             # shareService, data integrity
├── lib/                          # Shared utilities
│   ├── repositories/             # Per-entity localStorage repositories
│   ├── hooks/                    # useCrossTabSync, useDialogManager
│   ├── schemas.ts                # Zod schemas
│   ├── storage.ts                # Legacy storage helpers
│   ├── validation.ts             # Input validation
│   ├── deduplicateData.ts
│   └── utils.ts                  # General helpers
├── stores/                       # Zustand stores
│   ├── dataStore.ts              # Projects, tasks, sections
│   ├── appStore.ts               # App settings & UI state
│   └── filterStore.ts            # Search and filter state
├── types/                        # TypeScript type definitions
├── e2e/                          # Playwright end-to-end tests
├── scripts/                      # Build/CI scripts
└── public/                       # Static assets
```

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
