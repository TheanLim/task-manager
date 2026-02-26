# TMS UI/UX Design Specification

> This document is the authoritative design reference for all TMS views.
> Developers implement directly from this spec. No vague descriptions — every
> class name, token, and interaction is explicit.

---

## 1. Design Tokens

### Color Tokens

| Token | Tailwind class | Hex | Usage |
|---|---|---|---|
| Background | `bg-background` | `#0A0A0A` | Page / panel background |
| Card | `bg-card` | `#111111` | Default card surface |
| Elevated | `bg-muted` | `#1A1A1A` | Hover states, elevated cards |
| Border | `border` | `#1E1E1E` | All borders |
| Primary / teal | `bg-primary` / `text-primary` | `#0D9488` | Active states, CTAs, dot indicators |
| Secondary teal | `text-teal-400` | `#14B8A6` | Secondary accents, hover teal |
| CTA / orange | `text-orange-500` | `#F97316` | Sparingly — destructive-adjacent CTAs |
| Destructive | `bg-destructive` / `text-destructive` | `#EF4444` | Delete, abandon actions |
| Amber warning | `text-amber-500` / `border-amber-500` | `#F59E0B` | Dismissed tasks, Inbox badge, warnings |
| Foreground | `text-foreground` | `#F8FAFC` | Primary text |
| Muted text | `text-muted-foreground` | `#94A3B8` | Secondary text, labels, hints |
| Primary glow | `shadow-[0_0_12px_rgba(13,148,136,0.35)]` | — | Active tab glow |
| Primary tint | `bg-primary/5` | — | Current task card background |
| Primary tint hover | `bg-primary/10` | — | Hover on tinted cards |

### Spacing Scale

All spacing uses Tailwind's default 4px base unit.

| Usage | Class |
|---|---|
| Card internal padding | `p-3` (12px) |
| Card internal padding — expanded | `p-4` (16px) |
| Section gap | `space-y-6` (24px) |
| Inline element gap | `gap-2` (8px) |
| Icon + text gap | `gap-1.5` (6px) |
| Action row top margin | `mt-3 pt-3` |
| Tab bar padding | `px-4 py-2` |
| Empty state padding | `p-8` |

### Border Radius

| Usage | Class |
|---|---|
| Cards | `rounded-lg` (8px) |
| Badges | `rounded-full` |
| Buttons | `rounded-md` (6px) |
| Tab active indicator | `rounded-sm` (4px) |
| Inline panels | `rounded-md` |

### Shadow / Elevation

| Level | Class | Usage |
|---|---|---|
| 0 — flat | none | Default cards |
| 1 — raised | `shadow-sm` | Hover state on cards |
| 2 — floating | `shadow-md` | Drag overlay, popovers |
| 3 — glow | `shadow-[0_0_12px_rgba(13,148,136,0.35)]` | Active tab |

### Animation Durations & Easings

| Token | Value | Usage |
|---|---|---|
| `duration-150` | 150ms | Card hover, border transitions |
| `duration-200` | 200ms | Tab switch, badge swap, panel updates |
| `duration-300` | 300ms | Toast slide-in |
| `ease-out` | cubic-bezier(0,0,0.2,1) | All transitions |
| Pass complete delay | 1500ms | Auto-advance after pass complete |

All transitions wrapped in `motion-safe:` prefix. When `prefers-reduced-motion`
is active, all transitions are instant (`duration-0`).

### Z-Index Scale

| Layer | Value | Usage |
|---|---|---|
| Base | `z-0` | Cards, task rows |
| Sticky header | `z-10` | Tab bar, section headers |
| Overlay | `z-20` | Drag overlay |
| Dialog | `z-50` | Dialogs, AlertDialogs |
| Toast | `z-[60]` | Day rollover toast |

---

## 2. Shared Components

### `TaskCard`

**File:** `features/tms/components/shared/TaskCard.tsx`

**Props:**
```ts
interface TaskCardProps {
  task: Task;
  variant?: 'default' | 'current' | 'flagged' | 'attention' | 'completed';
  dotted?: boolean;           // FVP: show teal dot indicator on left
  showCheckbox?: boolean;     // default true
  showPriority?: boolean;     // default true
  showDueDate?: boolean;      // default true
  showProjectName?: boolean;  // default false — Review Queue uses this
  projectName?: string;
  actions?: React.ReactNode;  // slot for action buttons below task text
  onClick?: () => void;
  onComplete?: (completed: boolean) => void;
}
```

**Variants:**

| Variant | Classes |
|---|---|
| `default` | `bg-card border border-border rounded-lg p-3` |
| `current` | `bg-primary/5 border border-primary rounded-lg p-3` |
| `flagged` | `bg-card border-l-2 border-l-amber-500 border-t border-r border-b border-border rounded-lg p-3` |
| `attention` | `bg-card border-l-2 border-l-primary border-t border-r border-b border-border rounded-lg p-3` |
| `completed` | `bg-card border border-border rounded-lg p-3 opacity-60` |

**Anatomy (top to bottom, left to right):**
```
┌─────────────────────────────────────────────────────┐
│ [dot?] [checkbox] [task text]          [priority]   │
│                   [due date] [project name?]         │
│ ─────────────────────────────────────────────────── │
│ [actions slot — only when provided]                  │
└─────────────────────────────────────────────────────┘
```

- Dot indicator: `w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5` — only when `dotted={true}`
- Checkbox: shadcn `<Checkbox>` — `onClick` stops propagation
- Task text: `text-sm font-medium text-foreground` — `line-through text-muted-foreground` when completed
- Priority badge: see `PriorityBadge` below
- Due date: see `DueDateLabel` below
- Project name: `text-xs text-muted-foreground` — shown below due date when `showProjectName={true}`
- Actions slot: separated by `border-t border-border mt-3 pt-3`
- Hover: `hover:bg-muted transition-colors duration-150`
- Focus: `focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`
- Touch target: min `min-h-[44px]`

---

### `SectionHeader`

**File:** `features/tms/components/shared/SectionHeader.tsx`

**Props:**
```ts
interface SectionHeaderProps {
  title: string;
  count?: number;
  countVariant?: 'default' | 'secondary' | 'amber' | 'slate';
  hint?: string;           // small muted text after count
  rightSlot?: React.ReactNode;
  className?: string;
}
```

**Anatomy:**
```
[title h3]  [count badge]  [hint text]          [rightSlot]
```

- Title: `text-base font-semibold text-foreground`
- Count badge: `<Badge>` with variant mapped from `countVariant`
  - `default` → `bg-primary text-primary-foreground`
  - `secondary` → `bg-muted text-muted-foreground`
  - `amber` → `bg-amber-500/20 text-amber-500 border border-amber-500/30`
  - `slate` → `bg-slate-700 text-slate-300`
- Hint: `text-xs text-muted-foreground ml-1`
- Container: `flex items-center gap-2 mb-3`

---

### `PriorityBadge`

**File:** `features/tms/components/shared/PriorityBadge.tsx`

**Props:**
```ts
interface PriorityBadgeProps {
  priority: 'high' | 'medium' | 'low' | 'none';
}
```

| Priority | Classes | Label |
|---|---|---|
| `high` | `bg-destructive/20 text-destructive border border-destructive/30 text-xs rounded-full px-2 py-0.5` | `High` |
| `medium` | `bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs rounded-full px-2 py-0.5` | `Med` |
| `low` | `bg-muted text-muted-foreground border border-border text-xs rounded-full px-2 py-0.5` | `Low` |
| `none` | renders `null` | — |

Color is never the sole indicator — text label always present.

---

### `DueDateLabel`

**File:** `features/tms/components/shared/DueDateLabel.tsx`

**Props:**
```ts
interface DueDateLabelProps {
  dueDate: string | null | undefined;  // ISO date string
}
```

| State | Condition | Classes |
|---|---|---|
| Normal | future date | `text-xs text-muted-foreground flex items-center gap-1` |
| Today | same calendar day | `text-xs text-amber-500 flex items-center gap-1 font-medium` |
| Overdue | past date | `text-xs text-destructive flex items-center gap-1 font-medium` |

- Icon: `<Calendar className="h-3 w-3" />` — same color as text
- Format: `MMM d` (e.g. "Feb 20") — `MMM d, yyyy` if year differs from current
- Returns `null` when `dueDate` is falsy

---

### `TMSTabBar`

**File:** `features/tms/components/TMSTabBar.tsx`

**Props:**
```ts
interface TMSTabBarProps {
  handlers: TimeManagementSystemHandler[];  // from getAllTMSHandlers()
  activeSystemId: string;
  onSwitch: (systemId: string) => void;
  resumedSystemId?: string;  // shows "resumed" pill on this tab
}
```

**Layout:** `role="tablist"` — horizontal flex row, `w-full`, `border-b border-border`, `bg-card`, sticky `top-0 z-10`.

**Tab item anatomy:**
```
┌──────────────────────────────┐
│  [System Name]  [resumed?]   │
│  [description — muted]       │
│  ──── active indicator ────  │
└──────────────────────────────┘
```

**Active state:**
- Background: `bg-primary/10`
- Text: `text-primary font-semibold`
- Bottom border: `border-b-2 border-primary`
- Glow: `shadow-[0_2px_8px_rgba(13,148,136,0.25)]`

**Inactive state:**
- Background: `bg-transparent`
- Text: `text-muted-foreground`
- Hover: `hover:bg-muted hover:text-foreground transition-colors duration-150`

**"Resumed" pill:** `text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5 ml-1` — shown when `resumedSystemId === handler.id`

**Mobile (<640px):** `overflow-x-auto scrollbar-none` — descriptions hidden (`hidden sm:block`), names only, tabs shrink to `min-w-fit px-3`.

**Keyboard navigation:**
- `role="tab"` on each tab item
- `aria-selected={isActive}`
- `tabIndex={isActive ? 0 : -1}`
- `ArrowLeft` / `ArrowRight` moves focus between tabs
- `Enter` / `Space` activates focused tab
- `Home` / `End` jump to first/last tab

**System switching sequence:**
1. Call `handler.onDeactivate(currentState)` → apply delta
2. Call `onSwitch(newSystemId)` → store updates `activeSystem`
3. Call `newHandler.onActivate(tasks, existingState)` → apply delta
4. If `systemStates[newSystemId]` already exists → set `resumedSystemId`

---

### `TMSEmptyState`

**File:** `features/tms/components/shared/TMSEmptyState.tsx`

**Props:**
```ts
interface TMSEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

**Layout:** `flex flex-col items-center justify-center gap-3 py-12 text-center`

- Icon wrapper: `w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground`
- Title: `text-sm font-medium text-foreground`
- Description: `text-xs text-muted-foreground max-w-[240px]`
- Action button: `<Button variant="outline" size="sm">` — optional

---

## 3. Tab Bar / System Switcher

> Full spec — see `TMSTabBar` in Section 2 for props and keyboard nav.

**Container:**
```html
<div role="tablist" aria-label="Time management systems"
     class="flex w-full border-b border-border bg-card sticky top-0 z-10 overflow-x-auto scrollbar-none">
```

**Each tab item:**
```html
<button
  role="tab"
  aria-selected="true|false"
  tabindex="0|-1"
  class="flex flex-col items-start px-4 py-3 min-w-fit border-b-2 transition-colors duration-150
         [active]: border-primary bg-primary/10 text-primary
         [inactive]: border-transparent text-muted-foreground hover:bg-muted hover:text-foreground"
>
  <span class="flex items-center gap-1.5">
    <span class="text-sm font-semibold">{handler.displayName}</span>
    <!-- "resumed" pill — only when resumedSystemId matches -->
    <span class="text-[10px] bg-primary/20 text-primary rounded-full px-1.5 py-0.5">resumed</span>
  </span>
  <!-- description hidden on mobile -->
  <span class="text-xs text-muted-foreground hidden sm:block mt-0.5 leading-tight">
    {handler.description}
  </span>
</button>
```

**Active indicator:** `border-b-2 border-primary` on the button itself — no separate element needed.

**State preservation badge ("resumed"):**
- Appears when switching back to a system that has existing `systemStates[id]` data
- Fades out after 3s: `animate-fade-out delay-3000` (custom keyframe or use `setTimeout` to remove)
- Does NOT appear on first activation

**System switching animation:**
- Outgoing view: `opacity-100 → opacity-0 translate-y-0 → translate-y-1.5` over 150ms
- Incoming view: `opacity-0 translate-y-1.5 → opacity-100 translate-y-0` over 200ms ease-out
- Implemented via CSS classes toggled on the view container, not JS animation libraries

---
## 4. Review Queue View

**File:** `features/tms/components/StandardView.tsx`

### Header

```html
<div class="flex items-center justify-between mb-4">
  <div>
    <h1 class="text-xl font-bold text-foreground">All Tasks</h1>
    <!-- progress line -->
    <p class="text-xs text-muted-foreground mt-0.5">3 completed today</p>
  </div>
  <div class="flex items-center gap-2">
    <!-- Review Queue active indicator badge -->
    <Badge class="bg-primary/20 text-primary border border-primary/30">Review Queue</Badge>
    <!-- Nested/Flat toggle -->
    <Button variant="ghost" size="sm">Flat</Button>
    <!-- Completed filter -->
    <Button variant="ghost" size="sm">Hide completed</Button>
  </div>
</div>
```

- "X completed today" count: computed from tasks where `completed === true` and `completedAt` is today's date. Hidden when 0.
- Review Queue badge: always visible when this system is active — signals the user is in review mode.
- Nested/Flat toggle: `ghost` button, toggles between flat list and project-grouped view.
- Completed filter: `ghost` button, toggles `showCompleted` local state.

### Task List

Sorted by `lastActionAt` ascending (oldest first — tasks that haven't been touched longest surface first).

**First task only — "NEEDS ATTENTION" treatment:**
```html
<div class="relative">
  <!-- teal left border accent on the card -->
  <TaskCard variant="attention" task={firstTask} ... />
  <!-- label below task text, inside the card's actions slot -->
  <span class="text-[11px] font-semibold tracking-widest text-primary uppercase mt-1 block">
    ↑ Needs Attention
  </span>
  <!-- Reinsert button — ONLY on first task -->
  <Button variant="outline" size="sm"
          class="border-primary text-primary hover:bg-primary/10 mt-2">
    ↺ Reinsert
  </Button>
</div>
```

- `↺ Reinsert` button: only rendered on the first/top task card. Dispatches `{ type: 'REINSERT_TASK', taskId }`. Teal outline style: `border border-primary text-primary hover:bg-primary/10`.
- All other task cards: `<TaskCard variant="default">` — checkbox, text, priority badge, due date, project name (muted).
- Project name: `text-xs text-muted-foreground` below due date.

### Empty State

When all tasks have been reviewed (list is empty):
```tsx
<TMSEmptyState
  icon={<CheckCircle2 className="h-6 w-6" />}
  title="All caught up!"
  description="Nothing needs attention right now."
/>
```

---

## 5. FVP View

**File:** `features/tms/components/FVPView.tsx`

The view has three distinct states. The visual hierarchy rule: **"Do Now" is always at the top when a current task exists. Preselection panel is below it. Task list is always at the bottom.**

---

### State A — No current task (fresh start or all dotted tasks done)

```
┌─────────────────────────────────────────────────────┐
│  [Start Preselection]  (teal, full width)            │
├─────────────────────────────────────────────────────┤
│  Task list (all tasks, no dots, plain cards)         │
└─────────────────────────────────────────────────────┘
```

- "Start Preselection" button: `<Button className="w-full">Start Preselection</Button>` — teal fill, full width.
- Clicking sets `scanPosition` to 0 and begins the scan.
- Task list: unified list, all tasks as `<TaskCard variant="default">`.

**Empty state (no tasks at all):**
```tsx
<TMSEmptyState
  icon={<ListTodo className="h-6 w-6" />}
  title="No tasks yet"
  description="Add some tasks to get started with FVP."
/>
```

---

### State B — Preselection in progress (has currentX, has scanCandidate)

```
┌─────────────────────────────────────────────────────┐
│  DO NOW section (teal border card)                   │
│    [current task text]                               │
│    [✓ Done] button                                   │
├─────────────────────────────────────────────────────┤
│  PRESELECTION PANEL (teal border card)               │
│    "Current X:" label                                │
│    [X task card — teal X marker]                     │
│    "Do you want to do this more than X?"             │
│    [candidate task card — ? marker]                  │
│    [● Yes — dot it]  [No — skip]                     │
├─────────────────────────────────────────────────────┤
│  UNIFIED TASK LIST                                   │
│    (dotted tasks with teal dot + elevated card)      │
│    (current task with teal border + "Do Now" label)  │
│    (undotted tasks — plain cards)                    │
└─────────────────────────────────────────────────────┘
```

**Do Now section** (only when `currentTask` exists):
```html
<div class="mb-4">
  <p class="text-xs font-semibold tracking-widest text-primary uppercase mb-2">Do Now</p>
  <div class="bg-primary/5 border border-primary rounded-lg p-3 flex items-start gap-3">
    <Checkbox checked={false} onCheckedChange={...} />
    <span class="flex-1 text-sm font-medium text-foreground">{currentTask.description}</span>
    <Button size="sm" class="bg-primary hover:bg-primary/90 text-white shrink-0">
      ✓ Done
    </Button>
  </div>
</div>
```

**Preselection panel:**
```html
<div class="bg-card border border-primary rounded-lg p-4 mb-4">
  <p class="text-xs text-muted-foreground mb-2">Current X:</p>
  <!-- X task card with teal X marker -->
  <div class="bg-muted rounded-md p-3 flex items-center gap-2 mb-3">
    <span class="text-xs font-bold text-primary w-4 shrink-0">X</span>
    <span class="text-sm text-foreground">{currentX.description}</span>
  </div>

  <p class="text-xs text-muted-foreground mb-2">
    Do you want to do this more than X?
  </p>
  <!-- Candidate task card with ? marker -->
  <div class="bg-muted rounded-md p-3 flex items-center gap-2 mb-4">
    <span class="text-xs font-bold text-muted-foreground w-4 shrink-0">?</span>
    <span class="text-sm text-foreground">{scanCandidate.description}</span>
  </div>

  <div class="flex gap-2">
    <Button class="flex-1 bg-primary hover:bg-primary/90 text-white" onClick={handleDot}>
      ● Yes — dot it
    </Button>
    <Button variant="outline" class="flex-1" onClick={handleSkip}>
      No — skip
    </Button>
  </div>
</div>
```

- After clicking Yes or No: panel content updates immediately to the next candidate (no page reload, no full re-render — just state update triggers re-render). Transition: `opacity-0 → opacity-100` on panel content, 150ms.
- "● Yes — dot it": teal fill button. "No — skip": outline button. Side by side, equal width (`flex-1`).

---

### State C — Preselection complete (no more candidates)

```
┌─────────────────────────────────────────────────────┐
│  DO NOW section (teal border card + ✓ Done)          │
├─────────────────────────────────────────────────────┤
│  [Resume Preselection] (outline, full width)         │
│   — only if undotted tasks remain                    │
├─────────────────────────────────────────────────────┤
│  UNIFIED TASK LIST                                   │
└─────────────────────────────────────────────────────┘
```

- "Resume Preselection" button: `<Button variant="outline" className="w-full mb-4">Resume Preselection</Button>` — shown only when undotted tasks remain.
- "All done" empty state when no tasks remain:
```tsx
<TMSEmptyState
  icon={<PartyPopper className="h-6 w-6" />}
  title="All done!"
  description="Add more tasks or reset to start fresh."
  action={{ label: 'Reset FVP', onClick: handleReset }}
/>
```

---

### Unified Task List Anatomy

One list — no split sections. Order: dotted tasks first (in dot order, last dotted = top), then undotted tasks.

```
[teal dot] [checkbox] [task text]  [priority]    ← dotted task (elevated card)
           [checkbox] [task text]  [priority]    ← undotted task (plain card)
```

**Dotted task card:**
- `bg-muted border border-border` (slightly elevated vs plain)
- Left: `w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5` dot indicator
- The last dotted task (current task) gets `border-primary bg-primary/5` + "Do Now" label

**Current task in list** (last dotted — also shown in Do Now section above):
- `border border-primary bg-primary/5 rounded-lg`
- Small label: `text-[10px] font-semibold text-primary uppercase tracking-widest` reading "Do Now"
- This is a visual echo of the Do Now section above — same task, shown in context of the list

**Undotted task card:**
- `bg-card border border-border rounded-lg` — plain, no dot

---

## 6. AF4 View

**File:** `features/tms/components/AF4View.tsx`

---

### Phase Indicator Bar

```html
<div class="flex items-center gap-2 mb-4" aria-live="polite">
  <!-- Normal: one badge only -->
  <Badge class="bg-primary/20 text-primary border border-primary/30">
    Working Backlog
  </Badge>
  <!-- OR -->
  <Badge class="bg-slate-700 text-slate-300 border border-slate-600">
    Active List Pass
  </Badge>
</div>
```

- Only ONE badge visible at a time. Never show both simultaneously.
- Badge swap animation: outgoing fades `opacity-100 → opacity-0` (100ms), incoming fades in `opacity-0 → opacity-100` (200ms). Use `key` prop on the badge to trigger React remount.
- `aria-live="polite"` on the container so screen readers announce phase changes.

**Pass complete state** (replaces the phase badge entirely — see Section 6 "Pass complete state" below):
```html
<Badge class="bg-amber-500/20 text-amber-500 border border-amber-500/30">
  Backlog pass complete — switching to Active List
</Badge>
```

---

### Backlog Section

```html
<section aria-label="Backlog">
  <SectionHeader
    title="Backlog"
    count={backlogTasks.length}
    countVariant="secondary"
    hint={`Line drawn ${format(lineDrawnAt, 'MMM d, h:mmaaa')}`}
  />
  <div class="space-y-2">
    {backlogTasks.map((task, idx) => renderBacklogTask(task, idx === currentPosition))}
  </div>
</section>
```

**Current task card (expanded):**
```html
<div class="bg-primary/5 border border-primary rounded-lg p-3">
  <!-- Task header row -->
  <div class="flex items-start gap-3 mb-3">
    <Checkbox checked={task.completed} onCheckedChange={...} />
    <div class="flex-1 min-w-0">
      <span class="text-sm font-medium text-foreground">{task.description}</span>
      <div class="flex items-center gap-2 mt-1">
        <PriorityBadge priority={task.priority} />
        <DueDateLabel dueDate={task.dueDate} />
      </div>
    </div>
  </div>
  <!-- Action row — separated by border -->
  <div class="border-t border-border pt-3 flex items-center gap-2">
    <!-- PRIMARY: Made progress — teal outline, larger visual weight -->
    <Button variant="outline"
            class="border-primary text-primary hover:bg-primary/10 flex-1 text-sm">
      ↺ Made progress
    </Button>
    <!-- SECONDARY: Done — ghost, smaller -->
    <Button variant="ghost" size="sm" class="text-muted-foreground hover:text-foreground"
            onClick={handleDone}>
      ✓ Done
    </Button>
    <!-- Skip -->
    <Button variant="ghost" size="sm" class="text-muted-foreground" onClick={handleSkip}>
      → Skip
    </Button>
    <!-- Flag -->
    <Button variant="ghost" size="sm"
            aria-label="Flag as stubborn"
            class="text-amber-500 hover:text-amber-400"
            onClick={handleDismiss}>
      ⚠
    </Button>
  </div>
</div>
```

**Semantic distinction — "Made progress" vs "Done":**
- `↺ Made progress`: teal outline button, `flex-1` (widest). Dispatches `{ type: 'MADE_PROGRESS', taskId }`. Handler crosses task off backlog, appends to Active List end. Task is **NOT** marked `completed`. Visual weight: primary action.
- `✓ Done`: ghost button, `size="sm"`, muted text. Dispatches `{ type: 'COMPLETE_TASK', taskId }`. Marks task `completed: true`. Visual weight: secondary.
- These must never be visually equal — "Made progress" is always the dominant button.

---

### Dismissed Task Resolution (inline expansion)

Flagged/dismissed tasks show amber treatment:

```html
<!-- Flagged task card -->
<div class="border-l-2 border-l-amber-500 border-t border-r border-b border-border rounded-lg p-3">
  <div class="flex items-start gap-3">
    <AlertTriangle class="h-4 w-4 text-amber-500 shrink-0 mt-0.5 cursor-pointer"
                   onClick={toggleResolutionPanel}
                   aria-label="Resolve flagged task"
                   aria-expanded={isExpanded} />
    <span class="text-sm text-foreground">{task.description}</span>
  </div>

  <!-- Inline resolution panel — conditionally rendered -->
  {isExpanded && (
    <div class="mt-3 pt-3 border-t border-border bg-amber-500/5 rounded-b-lg -mx-3 -mb-3 px-3 pb-3">
      <p class="text-xs text-amber-500 mb-3">
        This task keeps getting skipped. What do you want to do?
      </p>
      <div class="flex gap-2">
        <Button variant="outline" size="sm"
                class="border-destructive text-destructive hover:bg-destructive/10">
          Abandon
        </Button>
        <Button variant="outline" size="sm"
                class="border-primary text-primary hover:bg-primary/10">
          Re-enter on Active List
        </Button>
        <Button variant="ghost" size="sm">
          Defer back to Backlog
        </Button>
      </div>
    </div>
  )}
</div>
```

- Expansion toggled by clicking the `⚠` icon. One panel open at a time (closing others on open).
- "Abandon": dispatches `{ type: 'RESOLVE_DISMISSED', taskId, resolution: 'abandon' }` — removes task from all lists.
- "Re-enter on Active List": dispatches `{ type: 'RESOLVE_DISMISSED', taskId, resolution: 'reenter' }` — moves to Active List end, clears dismissed flag.
- "Defer back to Backlog": dispatches `{ type: 'RESOLVE_DISMISSED', taskId, resolution: 'defer' }` — moves back to Backlog, clears dismissed flag.

---

### The Line Divider

```html
<div class="relative my-6" role="separator" aria-label={`Line drawn ${lineDrawnAtFormatted}`}>
  <!-- Solid line — NOT dashed -->
  <div class="absolute inset-0 flex items-center">
    <span class="w-full border-t-2 border-border" />
  </div>
  <!-- Centered timestamp label -->
  <div class="relative flex justify-center">
    <span class="bg-background px-3 text-xs text-muted-foreground font-medium">
      — Line drawn {format(lineDrawnAt, 'MMM d, h:mmaaa')} —
    </span>
  </div>
</div>
```

- `border-t-2` (2px) — heavier than a normal `<Separator>` (1px) to feel permanent.
- Solid, not dashed. The dashed style in the current implementation is incorrect.
- Timestamp format: `"Feb 20, 2:14pm"` using `date-fns` `format(date, 'MMM d, h:mmaaa')`.

---

### Active List Section

```html
<section aria-label="Active List">
  <SectionHeader
    title="Active List"
    count={activeTasks.length}
    countVariant="secondary"
    hint="(new tasks appear here)"
  />
  <div class="space-y-2">
    {activeTasks.map((task, idx) => renderActiveTask(task, af4.phase === 'active' && idx === af4.currentPosition))}
  </div>
</section>
```

- When `phase === 'active'`: current task highlighted same as Backlog current task (teal border, expanded action row).
- When `phase === 'backlog'`: all Active List tasks are plain `<TaskCard variant="default">` — no cursor highlighting.

---

### Pass Complete State

Triggered when `isFullPassComplete === true` AND `phase === 'backlog'` AND `!lastPassHadWork`.

**Replaces** the phase badge with:
```html
<Badge class="bg-amber-500/20 text-amber-500 border border-amber-500/30" aria-live="assertive">
  Backlog pass complete — switching to Active List
</Badge>
```

Then either:
1. Auto-advance after 1500ms (calls `advanceAfterFullPass`) — show a subtle countdown hint: `text-xs text-muted-foreground mt-1 block` reading "Switching in 1s…"
2. OR show a manual button: `<Button variant="outline" size="sm" class="mt-2">Switch to Active List →</Button>`

**Do NOT show both the "Working Backlog" badge and the "Pass complete" badge simultaneously.** The pass complete badge fully replaces the phase badge.

---

### Backlog Empty / Promotion State

When `backlogTasks.length === 0`:
```html
<div class="rounded-lg border border-primary/30 bg-primary/5 p-4 text-center mb-4">
  <p class="text-sm font-medium text-foreground mb-2">
    Backlog complete! Active List becomes the new Backlog.
  </p>
  <Button class="bg-primary hover:bg-primary/90 text-white">
    Draw new line →
  </Button>
</div>
```

Clicking "Draw new line →" dispatches `{ type: 'PROMOTE_ACTIVE_LIST' }` which moves all Active List tasks to Backlog and draws a new line.

---

### AF4 Empty States

```tsx
// Backlog empty (Active List has tasks):
<TMSEmptyState
  icon={<CheckCircle2 className="h-6 w-6" />}
  title="Backlog complete!"
  description="Ready to draw a new line."
  action={{ label: 'Draw new line →', onClick: handlePromote }}
/>

// Active List empty:
<TMSEmptyState
  icon={<Inbox className="h-6 w-6" />}
  title="Active List is empty"
  description="New tasks will appear here."
/>
```

---

## 7. DIT View

**File:** `features/tms/components/DITView.tsx`

Three zones stacked vertically. Each zone has a distinct left border color and header treatment.

---

### Today Zone

```html
<section aria-label="Today"
         class="rounded-lg border-l-2 border-l-primary border-t border-r border-b border-border p-4">
  <SectionHeader title="Today" count={todayTasks.length} countVariant="default" />

  {todayTasks.length === 0 ? (
    <TMSEmptyState
      icon={<Sun className="h-5 w-5" />}
      title="Nothing scheduled for today"
      description="Move tasks from Tomorrow or Inbox."
    />
  ) : (
    <div class="space-y-2">
      {todayTasks.map(task => (
        <TaskCard task={task} actions={
          <Button variant="ghost" size="sm" class="text-muted-foreground text-xs"
                  onClick={() => dispatch({ type: 'MOVE_TO_TOMORROW', taskId: task.id })}>
            → Tomorrow
          </Button>
        } />
      ))}
    </div>
  )}
</section>
```

- Left border: `border-l-2 border-l-primary` (teal)
- Count badge: `countVariant="default"` (teal)
- "→ Tomorrow" button: ghost, `size="sm"`, right-aligned in task card actions slot

---

### Tomorrow Zone

```html
<section aria-label="Tomorrow"
         class="rounded-lg border-l-2 border-l-slate-600 border-t border-r border-b border-border p-4">
  <SectionHeader title="Tomorrow" count={tomorrowTasks.length} countVariant="slate" />

  {tomorrowTasks.length === 0 ? (
    <TMSEmptyState
      icon={<CalendarDays className="h-5 w-5" />}
      title="Nothing for tomorrow yet"
      description="New tasks you create will appear here."
    />
  ) : (
    <div class="space-y-2">
      {tomorrowTasks.map(task => (
        <TaskCard task={task} actions={
          <Button variant="ghost" size="sm" class="text-muted-foreground text-xs"
                  onClick={() => dispatch({ type: 'MOVE_TO_TODAY', taskId: task.id })}>
            ← Today
          </Button>
        } />
      ))}
    </div>
  )}
</section>
```

- Left border: `border-l-2 border-l-slate-600` (slate)
- Count badge: `countVariant="slate"`

---

### Inbox Zone (renamed from "Unscheduled")

```html
<section aria-label="Inbox"
         class={`rounded-lg border-l-2 p-4
           ${inboxTasks.length > 0
             ? 'border-l-amber-500 border-t border-r border-b border-amber-500/30'
             : 'border-l-border border-t border-r border-b border-border'
           }`}>
  <SectionHeader
    title="Inbox"
    count={inboxTasks.length}
    countVariant={inboxTasks.length > 0 ? 'amber' : 'secondary'}
  />

  {inboxTasks.length === 0 ? (
    <TMSEmptyState
      icon={<Inbox className="h-5 w-5" />}
      title="All tasks are scheduled"
    />
  ) : (
    <div class="space-y-2">
      {inboxTasks.map(task => (
        <TaskCard task={task} actions={
          <div class="flex gap-1">
            <Button variant="ghost" size="sm" class="text-xs"
                    onClick={() => dispatch({ type: 'MOVE_TO_TODAY', taskId: task.id })}>
              → Today
            </Button>
            <Button variant="ghost" size="sm" class="text-xs"
                    onClick={() => dispatch({ type: 'MOVE_TO_TOMORROW', taskId: task.id })}>
              → Tomorrow
            </Button>
          </div>
        } />
      ))}
    </div>
  )}
</section>
```

- Left border: `border-l-amber-500` when non-empty, `border-l-border` when empty.
- Full border: `border-amber-500/30` when non-empty (subtle amber glow), `border-border` when empty.
- Count badge: amber when `> 0`, secondary when `0`.
- Drag handles: `<GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />` — leftmost element in each Inbox task card. Drag-and-drop via `@dnd-kit/core` (already used in current implementation).

**Amber tab badge:** When Inbox has items, the DIT tab in `TMSTabBar` shows an amber dot indicator:
```html
<!-- Inside the DIT tab button, after the system name -->
{inboxCount > 0 && (
  <span class="w-1.5 h-1.5 rounded-full bg-amber-500 ml-1 shrink-0" aria-label={`${inboxCount} unscheduled tasks`} />
)}
```

---

### Day Rollover Toast

Triggered in `onActivate` when `lastDayChange` date differs from today:

```tsx
// After onActivate detects rollover, show toast:
toast({
  title: 'Good morning!',
  description: "Yesterday's Tomorrow is now Today.",
  duration: 4000,
})
```

- Uses the app's existing toast/sonner setup.
- Shown once per day rollover, not on every activation.
- `z-[60]` to appear above all TMS UI.

---

## 8. Empty States

All empty states use `<TMSEmptyState>` (Section 2). Per-system variants:

| View | Condition | Icon | Title | Description | Action |
|---|---|---|---|---|---|
| Review Queue | No tasks | `CheckCircle2` | "All caught up!" | "Nothing needs attention right now." | — |
| FVP | No tasks at all | `ListTodo` | "No tasks yet" | "Add some tasks to get started with FVP." | — |
| FVP | Preselection complete, no current task | `PartyPopper` | "All done!" | "Add more tasks or reset to start fresh." | "Reset FVP" |
| AF4 Backlog | Backlog empty | `CheckCircle2` | "Backlog complete!" | "Ready to draw a new line." | "Draw new line →" |
| AF4 Active List | Active List empty | `Inbox` | "Active List is empty" | "New tasks will appear here." | — |
| DIT Today | Today empty | `Sun` | "Nothing scheduled for today" | "Move tasks from Tomorrow or Inbox." | — |
| DIT Tomorrow | Tomorrow empty | `CalendarDays` | "Nothing for tomorrow yet" | "New tasks you create will appear here." | — |
| DIT Inbox | Inbox empty | `Inbox` | "All tasks are scheduled" | — | — |

All icons from `lucide-react`. Icon wrapper: `w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground`.

---

## 9. Accessibility Spec

### Touch Targets
All interactive elements: `min-h-[44px] min-w-[44px]`. For small icon buttons, use `p-2.5` padding to expand the hit area without changing visual size.

### Focus Rings
```css
/* Applied to all interactive elements */
focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background
```

### Tab Bar Keyboard Navigation
```
ArrowLeft / ArrowRight  → move focus between tabs (wraps)
Home                    → focus first tab
End                     → focus last tab
Enter / Space           → activate focused tab
```
Implementation: `onKeyDown` handler on each `role="tab"` element. Use `refs` array to call `.focus()` on adjacent tabs.

### Task Cards
- `role="article"` on each card
- `Enter` on focused card → calls `onTaskClick(task.id)`
- `Space` on focused card → toggles checkbox (calls `onComplete`)
- Checkbox: `aria-label={`Mark "${task.description}" as complete`}`

### AF4 Action Buttons
Icon-only buttons must have `aria-label`:
- Flag button: `aria-label="Flag as stubborn"`
- Skip button: `aria-label="Skip task"`
- The `⚠` icon button: `aria-label="Resolve flagged task"` + `aria-expanded={isExpanded}`

### ARIA Live Regions
```html
<!-- Phase transitions (AF4) -->
<div aria-live="polite" aria-atomic="true">
  {phaseBadge}
</div>

<!-- Pass complete (AF4) — assertive because it auto-advances -->
<div aria-live="assertive" aria-atomic="true">
  {passCompleteBadge}
</div>

<!-- Preselection panel updates (FVP) -->
<div aria-live="polite" aria-atomic="true">
  {preselectionPanel}
</div>
```

### Color Independence
- Priority: color + text label (never color alone) — see `PriorityBadge`
- Dot indicators (FVP): teal dot + `aria-label="Dotted task"` on the dot element
- Inbox amber badge: amber color + numeric count + `aria-label`
- Dismissed tasks: amber border + `⚠` icon (not color alone)

### Reduced Motion
All transition classes prefixed with `motion-safe:`:
```html
class="motion-safe:transition-colors motion-safe:duration-150"
class="motion-safe:transition-opacity motion-safe:duration-200"
```
When `prefers-reduced-motion: reduce` is active, all state changes are instant.

---

## 10. Animation & Transition Spec

### Tab Switch (view container)
```css
/* Outgoing view */
.tms-view-exit {
  opacity: 1;
  transform: translateY(0);
}
.tms-view-exit-active {
  opacity: 0;
  transform: translateY(6px);
  transition: opacity 150ms ease-out, transform 150ms ease-out;
}

/* Incoming view */
.tms-view-enter {
  opacity: 0;
  transform: translateY(6px);
}
.tms-view-enter-active {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 200ms ease-out, transform 200ms ease-out;
}
```
Implementation: toggle Tailwind classes via `useState` + `useEffect`, or use a lightweight CSS transition library. Do NOT use Framer Motion for this — it's overkill.

### Task Card Hover
```
translateY(0) → translateY(-1px)
shadow-none → shadow-sm
duration-150 ease-out
```
Classes: `motion-safe:hover:-translate-y-px motion-safe:hover:shadow-sm motion-safe:transition-all motion-safe:duration-150`

### Current Task Highlight (border-color transition)
```
border-border → border-primary
duration-150 ease-out
```
Classes: `motion-safe:transition-colors motion-safe:duration-150`

### Phase Badge Swap (AF4)
Use React `key` prop to trigger remount + CSS fade:
```tsx
<div key={currentPhaseKey} className="motion-safe:animate-fade-in">
  {phaseBadge}
</div>
```
`animate-fade-in`: `@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }` — 200ms.

### Preselection Panel Update (FVP — after Yes/No)
Panel content (X card + candidate card) fades and slides:
```
opacity: 1, translateY: 0 → opacity: 0, translateY: -4px (150ms)
then: new content opacity: 0, translateY: 4px → opacity: 1, translateY: 0 (150ms)
```
Use `key={scanCandidate.id}` on the panel content div to trigger remount.

### Pass Complete Auto-Advance (AF4)
```tsx
useEffect(() => {
  if (!isPassComplete) return;
  const timer = setTimeout(() => {
    dispatch({ type: 'ADVANCE_AFTER_FULL_PASS' });
  }, 1500);
  return () => clearTimeout(timer);
}, [isPassComplete]);
```
Show countdown hint: `"Switching in 1s…"` — update with `setInterval` every 100ms if desired, or just show static text.

### Skeleton Loading (initial load)
While `tasks` prop is loading (empty array + loading flag):
```html
<div class="space-y-2">
  {[1,2,3].map(i => (
    <div key={i} class="h-14 rounded-lg bg-muted motion-safe:animate-pulse" />
  ))}
</div>
```

### Reduced Motion Override
All `motion-safe:` prefixed classes are automatically disabled when `prefers-reduced-motion: reduce`. No additional JS needed.

---

## 11. Responsive Behavior

### Desktop (≥1024px)
- Full layout, all controls visible in header
- Tab bar: full tabs with name + description
- Task cards: full anatomy — checkbox, text, priority, due date, project name, actions
- DIT zones: stacked vertically (full width)
- AF4 action row: horizontal flex, all 4 buttons in one row

### Tablet (640–1023px)
- Header controls wrap to second line: `flex-wrap gap-2`
- Tab bar: descriptions visible (`sm:block`)
- Task cards: priority badge may wrap below task text on narrow cards
- AF4 action row: still horizontal, buttons may shrink (`text-xs`)

### Mobile (<640px)
- Tab bar: `overflow-x-auto scrollbar-none`, descriptions hidden (`hidden sm:block`), names only, `px-3 py-2` per tab
- Due dates hidden on task cards: `hidden sm:flex` on `DueDateLabel` wrapper
- AF4 action row: wraps to 2×2 grid: `grid grid-cols-2 gap-2`
  - Row 1: "↺ Made progress" (full width col-span-2) — most important action stays prominent
  - Row 2: "✓ Done" + "→ Skip"
  - Flag button: below row 2, right-aligned
- DIT zones: stacked vertically (already the case — no change)
- FVP preselection panel: Yes/No buttons stack vertically (`flex-col`)
- Inbox task actions: "→ Today" and "→ Tomorrow" stack vertically

---

## 12. Component File Map

### `features/tms/components/TMSTabBar.tsx`

```ts
interface TMSTabBarProps {
  handlers: TimeManagementSystemHandler[];
  activeSystemId: string;
  onSwitch: (systemId: string) => void;
  resumedSystemId?: string;
  // DIT-specific: pass inboxCount so tab can show amber dot
  inboxCount?: number;
}
```

Key state: `focusedIndex` (for keyboard nav arrow key tracking).

Key interactions:
- Click tab → `onSwitch(handler.id)`
- `ArrowLeft/Right` → move `focusedIndex`, call `tabRefs[idx].current?.focus()`
- `Home/End` → jump to first/last
- `Enter/Space` → `onSwitch(handlers[focusedIndex].id)`

---

### `features/tms/components/TMSHost.tsx`

```ts
interface TMSHostProps {
  tasks: Task[];
  onTaskClick: (taskId: string) => void;
  onTaskComplete: (taskId: string, completed: boolean) => void;
}
```

Key state: `resumedSystemId: string | null` (set when switching back to a system with existing state, cleared after 3s).

Key interactions:
- Reads `state.activeSystem` from `useTMSStore()`
- Calls `getTMSHandler(activeSystem)` to get handler
- Builds `dispatch` via `useCallback` wrapping `handler.reduce` + `applySystemStateDelta`
- Renders `<TMSTabBar>` + `<ErrorBoundary>` + `<ViewComponent>`
- On tab switch: calls `onDeactivate` → `setActiveSystem` → `onActivate`
- Sets `resumedSystemId` when switching to a system with existing `systemStates[id]`

---

### `features/tms/components/shared/TaskCard.tsx`

```ts
interface TaskCardProps {
  task: Task;
  variant?: 'default' | 'current' | 'flagged' | 'attention' | 'completed';
  dotted?: boolean;
  showCheckbox?: boolean;
  showPriority?: boolean;
  showDueDate?: boolean;
  showProjectName?: boolean;
  projectName?: string;
  actions?: React.ReactNode;
  onClick?: () => void;
  onComplete?: (completed: boolean) => void;
}
```

Key state: none (pure presentational).

Key interactions:
- `Enter` on card → `onClick?.()`
- `Space` on card → `onComplete?.(!task.completed)`
- Checkbox `onCheckedChange` → `onComplete?.(checked)`
- Checkbox `onClick` → `e.stopPropagation()`

---

### `features/tms/components/shared/SectionHeader.tsx`

```ts
interface SectionHeaderProps {
  title: string;
  count?: number;
  countVariant?: 'default' | 'secondary' | 'amber' | 'slate';
  hint?: string;
  rightSlot?: React.ReactNode;
  className?: string;
}
```

Key state: none (pure presentational).

---

### `features/tms/components/shared/TMSEmptyState.tsx`

```ts
interface TMSEmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}
```

Key state: none (pure presentational).

---

### `features/tms/components/StandardView.tsx` (Review Queue)

```ts
interface StandardViewProps extends TMSViewProps<StandardState> {
  // TMSViewProps provides: tasks, systemState, dispatch, onTaskClick, onTaskComplete
}
```

Key state:
- `showCompleted: boolean` — local toggle
- `viewMode: 'flat' | 'nested'` — local toggle

Key interactions:
- "↺ Reinsert" on first task → `dispatch({ type: 'REINSERT_TASK', taskId })`
- Nested/Flat toggle → `setViewMode`
- Hide/Show completed → `setShowCompleted`

---

### `features/tms/components/FVPView.tsx`

```ts
interface FVPViewProps extends TMSViewProps<FVPState> {}
```

Key state: none beyond `systemState` (all FVP state lives in handler).

Key interactions:
- "Start Preselection" / "Resume Preselection" → `dispatch({ type: 'START_PRESELECTION' })`
- "● Yes — dot it" → `dispatch({ type: 'DOT_TASK', taskId: scanCandidate.id })`
- "No — skip" → `dispatch({ type: 'SKIP_CANDIDATE', taskId: scanCandidate.id })`
- "✓ Done" on current task → `onTaskComplete(currentTask.id, true)` + `dispatch({ type: 'COMPLETE_CURRENT' })`
- "Reset FVP" → `dispatch({ type: 'RESET_FVP' })`

---

### `features/tms/components/AF4View.tsx`

```ts
interface AF4ViewProps extends TMSViewProps<AF4State> {}
```

Key state:
- `expandedDismissedId: string | null` — which dismissed task's resolution panel is open

Key interactions:
- "↺ Made progress" → `dispatch({ type: 'MADE_PROGRESS', taskId: current.id })`
- "✓ Done" → `onTaskComplete(current.id, true)` + `dispatch({ type: 'COMPLETE_TASK', taskId: current.id })`
- "→ Skip" → `dispatch({ type: 'SKIP_TASK' })`
- "⚠ Flag" → `dispatch({ type: 'DISMISS_TASK', taskId: current.id })`
- `⚠` icon on dismissed task → `setExpandedDismissedId(task.id)` (toggle)
- "Abandon" → `dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution: 'abandon' })`
- "Re-enter on Active List" → `dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution: 'reenter' })`
- "Defer back to Backlog" → `dispatch({ type: 'RESOLVE_DISMISSED', taskId, resolution: 'defer' })`
- "Draw new line →" → `dispatch({ type: 'PROMOTE_ACTIVE_LIST' })`
- Pass complete auto-advance → `dispatch({ type: 'ADVANCE_AFTER_FULL_PASS' })` after 1500ms

---

### `features/tms/components/DITView.tsx`

```ts
interface DITViewProps extends TMSViewProps<DITState> {}
```

Key state:
- `activeId: string | null` — dnd-kit drag state

Key interactions:
- "→ Tomorrow" → `dispatch({ type: 'MOVE_TO_TOMORROW', taskId })`
- "← Today" → `dispatch({ type: 'MOVE_TO_TODAY', taskId })`
- "→ Today" (from Inbox) → `dispatch({ type: 'MOVE_TO_TODAY', taskId })`
- "→ Tomorrow" (from Inbox) → `dispatch({ type: 'MOVE_TO_TOMORROW', taskId })`
- Drag end to zone → same dispatch as button actions
- `onActivate` day rollover → show toast (handled in `TMSHost`, not `DITView`)

---

## Appendix: Action Type Reference

Quick reference for all dispatch action types used across views. Each handler's `reduce()` must handle these.

### StandardHandler actions
| Type | Payload | Effect |
|---|---|---|
| `REINSERT_TASK` | `taskId: string` | Moves task to top of review queue (resets `lastActionAt`) |

### FVPHandler actions
| Type | Payload | Effect |
|---|---|---|
| `START_PRESELECTION` | — | Sets `scanPosition` to 0, begins scan |
| `DOT_TASK` | `taskId: string` | Adds to `dottedTasks`, advances `scanPosition` |
| `SKIP_CANDIDATE` | `taskId: string` | Advances `scanPosition` without dotting |
| `COMPLETE_CURRENT` | — | Removes current task from `dottedTasks`, recalculates position |
| `RESET_FVP` | — | Clears `dottedTasks`, resets `scanPosition` to 0 |

### AF4Handler actions
| Type | Payload | Effect |
|---|---|---|
| `MADE_PROGRESS` | `taskId: string` | Removes from backlog, appends to Active List end. Task NOT completed. |
| `COMPLETE_TASK` | `taskId: string` | Marks task `completed: true`, removes from all lists |
| `SKIP_TASK` | — | Advances `currentPosition` |
| `DISMISS_TASK` | `taskId: string` | Adds to `dismissedTaskIds`, advances cursor |
| `RESOLVE_DISMISSED` | `taskId, resolution: 'abandon'\|'reenter'\|'defer'` | See Section 6 |
| `ADVANCE_AFTER_FULL_PASS` | — | Promotes Active List to Backlog, draws new line |
| `PROMOTE_ACTIVE_LIST` | — | Moves Active List → Backlog, clears Active List, draws new line |

### DITHandler actions
| Type | Payload | Effect |
|---|---|---|
| `MOVE_TO_TODAY` | `taskId: string` | Adds to `todayTasks`, removes from `tomorrowTasks` |
| `MOVE_TO_TOMORROW` | `taskId: string` | Adds to `tomorrowTasks`, removes from `todayTasks` |
| `REMOVE_FROM_SCHEDULE` | `taskId: string` | Removes from both lists (back to Inbox) |
