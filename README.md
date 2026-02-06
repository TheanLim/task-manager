# Task Management Web App

A modern, feature-rich task management application with integrated time management methodologies. Built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Project Management
- ✅ Create, edit, and delete projects
- ✅ Multiple projects with independent task lists
- ✅ Project descriptions and metadata
- ✅ **Shareable project URLs** - Each project has its own URL for bookmarking and sharing
- ✅ Three view modes per project:
  - **List View**: Traditional task list grouped by sections
  - **Board View**: Kanban-style board with drag-and-drop between columns
  - **Calendar View**: Calendar-based view showing tasks by due date

### Task Management
- ✅ Create, edit, and delete tasks
- ✅ Rich task properties:
  - Description and notes
  - Priority levels (None, Low, Medium, High)
  - Due dates with calendar picker
  - Tags for organization
  - Assignee tracking
- ✅ Subtasks with unlimited nesting
- ✅ Task completion tracking
- ✅ Section-based organization
- ✅ Task dependencies (blocking/blocked by)

### Time Management Systems
Choose from four different time management methodologies:

1. **None (Standard Mode)** - Traditional task list with manual organization
2. **DIT (Do It Tomorrow)** - Tasks organized into "Today" and "Tomorrow" with automatic rollover
3. **AF4 (Autofocus 4)** - Mark tasks to focus on, work through them in order
4. **FVP (Final Version Perfected)** - Compare tasks pairwise to build a prioritized "dotted" list

See the detailed guide below for how to use each system effectively.

### View Modes
Switch between three different ways to visualize your tasks:

1. **List View** - Traditional task list grouped by sections
   - Best for: Sequential work, detailed task information
   - Features: Section organization, subtask nesting, full task details

2. **Board View** - Kanban-style board with columns
   - Best for: Workflow visualization, status tracking
   - Features: Drag-and-drop between columns, visual workflow, task cards
   - Note: Requires columns to be set up for the project

3. **Calendar View** - Calendar-based task visualization
   - Best for: Deadline management, time-based planning
   - Features: Monthly calendar, tasks by due date, unscheduled task list
   - Note: Tasks without due dates appear in a separate "No Due Date" section

**Switching Views**: Click the view mode buttons (List/Board/Calendar) in the header when a project is selected. Each project remembers its preferred view mode.

### Data Management
- ✅ Automatic localStorage persistence
- ✅ Export data to JSON with timestamp
- ✅ Import data with merge or replace options
- ✅ Data validation and error handling
- ✅ Backup and restore capabilities

### User Interface
- ✅ Responsive design (mobile, tablet, desktop)
- ✅ Dark/Light/System theme support
- ✅ Collapsible sidebar for mobile
- ✅ Task detail panel
- ✅ Empty states and helpful messages
- ✅ Accessible components (WCAG 2.1 AA)
- ✅ Error boundary for graceful error handling

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 3
- **UI Components**: shadcn/ui (Radix UI primitives)
- **State Management**: Zustand with persistence
- **Date Handling**: date-fns
- **Icons**: Lucide React
- **Testing**: Vitest + React Testing Library + fast-check
- **Build**: Static export for GitHub Pages

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd task-manager
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Building for Production

Build the static site:
```bash
npm run build
```

The static files will be generated in the `out/` directory.

### Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Project Structure

```
task-manager/
├── app/                    # Next.js app directory
│   ├── page.tsx           # Main application page
│   ├── layout.tsx         # Root layout with providers
│   └── globals.css        # Global styles
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── Layout.tsx        # Main layout component
│   ├── ProjectList.tsx   # Project sidebar
│   ├── ProjectDialog.tsx # Project form
│   ├── TaskList.tsx      # Task list view
│   ├── TaskDialog.tsx    # Task form
│   ├── TaskDetailPanel.tsx # Task details
│   ├── ImportExportMenu.tsx # Data import/export
│   ├── ThemeProvider.tsx # Theme management
│   ├── ThemeToggle.tsx   # Theme switcher
│   └── ErrorBoundary.tsx # Error handling
├── lib/                   # Utility libraries
│   ├── tms/              # Time management system handlers
│   ├── storage.ts        # Data persistence
│   ├── validation.ts     # Input validation
│   ├── dependencyResolver.ts # Task dependencies
│   └── utils.ts          # Helper functions
├── stores/               # Zustand stores
│   ├── dataStore.ts     # Projects, tasks, sections, etc.
│   ├── tmsStore.ts      # Time management state
│   ├── appStore.ts      # App settings
│   └── filterStore.ts   # Search and filters
├── types/               # TypeScript type definitions
│   └── index.ts
└── tests/               # Test files (*.test.ts/tsx)
```

### Time Management Systems

The app includes four time management methodologies to help you prioritize and organize your work:

#### 1. **None (Standard Mode)**
The default mode with no special time management rules.

**How to use:**
- Tasks appear in their natural order
- Organize tasks using sections
- Manually prioritize as needed

**Best for:** Simple task lists, teams, or when you prefer manual organization

---

#### 2. **DIT (Do It Tomorrow)**
Based on Mark Forster's "Do It Tomorrow" methodology. Tasks are organized into "Today" and "Tomorrow" lists.

**How to use:**
1. Select "Do It Tomorrow (DIT)" from the Time Management System dropdown
2. New tasks automatically go to "Tomorrow"
3. At the start of each day, tasks from "Tomorrow" roll over to "Today"
4. **Drag and drop** tasks between Today, Tomorrow, and Unscheduled sections
5. Or use the arrow buttons (← →) to move tasks between sections
6. Focus on completing today's tasks before the day ends

**Drag-and-drop features:**
- Drag tasks from Tomorrow to Today when you want to work on them sooner
- Drag tasks from Today to Tomorrow to defer them
- Drag tasks to Unscheduled to remove them from the schedule
- Sections become scrollable when they have more than 10 tasks
- Works with both mouse and touch (mobile/tablet)

**Key principles:**
- Only work on tasks in the "Today" list
- Don't add new tasks to "Today" - they go to "Tomorrow"
- Incomplete tasks automatically roll over at day change
- Helps prevent overcommitment and burnout

**Best for:** People who struggle with overcommitment, want clear daily boundaries, or need help saying "no" to urgent requests

---

#### 3. **AF4 (Autofocus 4)**
Based on Mark Forster's Autofocus 4 system. Mark tasks you want to focus on, and they appear at the top of your list.

**How to use:**
1. Select "Autofocus 4 (AF4)" from the Time Management System dropdown
2. Review your task list
3. Click "Mark" on tasks you feel ready to work on
4. Marked tasks appear in the "Marked Tasks" section in the order you marked them
5. Work through marked tasks from top to bottom
6. Click "Unmark" to remove a task from your focus list
7. When you complete a task, it's automatically unmarked

**Key principles:**
- Only mark tasks you genuinely feel ready to do
- Work through marked tasks in order
- Don't overthink - trust your intuition
- Re-mark tasks if needed

**Best for:** People who get overwhelmed by long task lists, prefer intuitive selection, or want a simple prioritization method

---

#### 4. **FVP (Final Version Perfected)**
Based on Mark Forster's Final Version Perfected system. Compare tasks pairwise to build a prioritized list.

**How to use:**
1. Select "Final Version Perfected (FVP)" from the Time Management System dropdown
2. Click "Start Selection" to begin the prioritization process
3. The system shows you a reference task (X) and asks: "Would you do this task before X?"
4. For each comparison task:
   - Click "Yes, do this before X" if you'd do it first (task gets "dotted")
   - Click "Skip" if you wouldn't do it before X
5. Continue until you've reviewed all tasks
6. Click "End Selection" when done
7. Work through dotted tasks from top to bottom (they appear in reverse order of selection)
8. Click "Reset" to clear all dots and start over

**Key principles:**
- The question is "Would I do this before X?" not "Is this more important?"
- Trust your gut reaction - don't overthink
- Dotted tasks appear in working order (most urgent first)
- Only work on dotted tasks
- Reset and re-prioritize as needed

**Best for:** People who struggle with prioritization, have many competing tasks, or want a systematic way to choose what to work on next

---

### Switching Between Systems

1. Click on the Time Management System dropdown (appears when you have a project selected)
2. Select a different system
3. Confirm the switch (you'll see a warning that system-specific data will be cleared)
4. Your tasks remain unchanged - only the organization changes

**Note:** When you switch systems, any system-specific metadata (like DIT's today/tomorrow assignments or AF4's marks) is cleared, but your tasks, projects, and other data remain intact.

---

### Tips for Success

**General:**
- Start with "None" to get familiar with the app
- Try each system for at least a week before deciding
- You can switch systems anytime without losing tasks
- Export your data regularly as a backup

**DIT Tips:**
- Review tomorrow's list at the end of each day
- Be realistic about what fits in "Today"
- Use the move-to-today button sparingly

**AF4 Tips:**
- Don't mark too many tasks at once (5-10 is ideal)
- Re-mark tasks if your priorities change
- Trust your intuition when marking

**FVP Tips:**
- Answer quickly - first instinct is usually right
- Reset and re-prioritize when circumstances change
- Focus only on dotted tasks
- The system works best with 10-30 tasks

---

## Usage Guide

### URL Structure

The app uses query parameters for project routing, making it easy to share and bookmark specific projects:

- **Project List**: `http://localhost:3000/` (or your deployed URL)
- **Specific Project**: `http://localhost:3000/?project=<project-id>`

**Features:**
- ✅ **Shareable URLs**: Copy the URL when viewing a project and share it with others
- ✅ **Bookmarkable**: Bookmark specific projects in your browser
- ✅ **Browser Navigation**: Use back/forward buttons to navigate between projects
- ✅ **Direct Access**: Open a project URL directly to jump to that project

**Example:**
```
https://your-app.com/?project=abc-123-def-456
```

### Creating Your First Project

1. Click "Create Project" in the sidebar
2. Enter a project name (required)
3. Add an optional description
4. Choose a default view mode
5. Click "Create Project"

### Managing Tasks

1. Select a project from the sidebar
2. Click "New Task" in the header
3. Fill in task details:
   - Description (required)
   - Notes, assignee, priority, tags, due date (optional)
4. Click "Create Task"

### Using Subtasks

1. Click on a task to open the detail panel
2. Click "Add Subtask"
3. Create the subtask like a regular task
4. Subtasks appear nested under their parent

### Task Dependencies

1. Open a task's detail panel
2. Click "Add Dependency"
3. Select a task to create a dependency with
4. Choose "blocks" or "blocked by"

### Search and Filtering

1. Use the search bar to find tasks by description, tags, or assignee
2. Apply filters:
   - **Priority**: Filter by High, Medium, or Low priority
   - **Due Date Range**: Select start and end dates
   - **Status**: Show all, incomplete, or completed tasks
   - **Actionable Tasks**: Show only tasks not blocked by dependencies
3. Click "Clear all" to remove all filters

### Time Management Systems

See the detailed "Time Management Systems" section above for complete guides on using DIT, AF4, FVP, and Standard modes.

### Exporting Data

1. Click "Data" in the header
2. Select "Export Data"
3. A JSON file will download with timestamp

### Importing Data

1. Click "Data" in the header
2. Select "Import Data"
3. Choose a JSON file
4. Select "Replace All" or "Merge"
5. Confirm the import

### Changing Theme

1. Click the sun/moon icon in the header
2. Choose Light, Dark, or System theme

## Deployment

### GitHub Pages

1. Build the static site:
```bash
npm run build
```

2. Deploy the `out/` directory to GitHub Pages

3. Configure GitHub Pages to serve from the `out/` directory

### Vercel

1. Connect your repository to Vercel
2. Vercel will automatically detect Next.js
3. Deploy with default settings

### Netlify

1. Connect your repository to Netlify
2. Set build command: `npm run build`
3. Set publish directory: `out`
4. Deploy

## Browser Support

- Chrome/Edge (latest)
- Firefox (latest)
- Safari (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Data Storage

All data is stored locally in your browser's localStorage. No data is sent to any server. To backup your data, use the Export feature regularly.

## Contributing

This is a personal project, but suggestions and bug reports are welcome!

## License

MIT License - feel free to use this project for personal or commercial purposes.

## Acknowledgments

- Time management methodologies:
  - DIT: Mark Forster
  - AF4: Mark Forster
  - FVP: Mark Forster
- UI components: shadcn/ui
- Icons: Lucide React

## Support

For issues or questions, please open an issue on GitHub.

---

Built with ❤️ using Next.js and TypeScript
