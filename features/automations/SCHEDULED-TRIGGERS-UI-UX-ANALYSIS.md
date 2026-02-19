# Scheduled/Timer-Based Triggers — UI/UX Analysis

**Author**: UI/UX Designer
**Status**: Decisions Finalized — aligned with Architecture, PM, and QA docs
**Date**: 2025-02-20
**Stack**: Next.js + Tailwind + shadcn/ui (existing component library)
**Design Tokens**: Inherits from existing automation UI — `accent-brand`, category border colors, Card/Badge/Dialog patterns

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Trigger Step — Schedule Category](#2-trigger-step--schedule-category)
3. [Schedule Configuration Panel](#3-schedule-configuration-panel)
4. [Review Step — Scheduled Trigger Flow Diagram](#4-review-step--scheduled-trigger-flow-diagram)
5. [Rule Card — Scheduled Rule Variant](#5-rule-card--scheduled-rule-variant)
6. [Notification Design](#6-notification-design)
7. [Client-Side Limitations Messaging](#7-client-side-limitations-messaging)
8. [Run Now Button](#8-run-now-button)
9. [Accessibility Audit](#9-accessibility-audit)
10. [Responsive Behavior](#10-responsive-behavior)
11. [Component Inventory](#11-component-inventory)
12. [Interaction Specifications](#12-interaction-specifications)
13. [Cross-Doc References](#13-cross-doc-references)

---

## 1. Design Principles

### 1.1 Consistency with Existing Automation UI

The existing automation UI establishes strong patterns that scheduled triggers must follow:

- **Category cards with colored left borders** — Card Move (blue), Card Change (emerald), Section Change (violet). Scheduled triggers get a new color: **amber** (`border-l-amber-500`). Amber signals "time-based" — warm, clock-like, distinct from the cool tones of event triggers.
- **Radio button selection within category cards** — Each trigger type is a radio option. Scheduled triggers follow the same pattern within their own category card.
- **Inline configuration below selected radio** — When a trigger needs extra config (e.g., section picker for `card_moved_into_section`), it appears below the selected radio. Schedule config follows this pattern — selecting a scheduled trigger reveals the `ScheduleConfigPanel` inline.
- **4-step wizard** — Trigger → Filters → Action → Review. Scheduled triggers don't add a step — the schedule config is part of the Trigger step. The wizard flow is unchanged.
- **Natural language preview** — The preview bar at the bottom shows a human-readable sentence. Scheduled triggers change the sentence structure from "When a card is [trigger]..." to "Every [schedule], for cards [filters]..." (Architecture Appendix C).

### 1.2 Progressive Disclosure

Schedule configuration has 3 levels of complexity:

1. **Interval** — simplest: just a number + unit picker ("Every 30 minutes")
2. **Cron (structured)** — medium: time picker + day selector ("Monday at 9:00 AM")
3. **Due-date-relative** — simplest for the user: number + direction ("2 days before due date")

The UI presents these as 3 sub-options within the "Scheduled" category card. Selecting one reveals only the relevant config fields — no unused fields visible.

### 1.3 No Jargon

- Never show "cron" to the user. The internal type is `scheduled_cron` but the UI label is "At a specific time."
- Never show "interval" as a technical term. The UI label is "On a recurring interval."
- Never show `offsetMinutes`. The UI shows "2 days before due date" with a number input + unit dropdown + direction toggle.

---

## 2. Trigger Step — Schedule Category

### 2.1 Layout

The Trigger step gains a 4th category card below the existing three:

```
┌─────────────────────────────────────────────┐
│ 🔵 Card Move                                │  ← existing (border-l-blue-500)
│   ○ moved into section                      │
│   ○ moved out of section                    │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ 🟢 Card Change                              │  ← existing (border-l-emerald-500)
│   ○ marked complete                         │
│   ○ marked incomplete                       │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ 🟣 Section Change                           │  ← existing (border-l-violet-500)
│   ○ section created                         │
│   ○ section renamed                         │
└─────────────────────────────────────────────┘
┌─────────────────────────────────────────────┐
│ 🟠 Scheduled                                │  ← NEW (border-l-amber-500)
│   ○ on a recurring interval                 │
│   ○ at a specific time                      │
│   ○ relative to due date                    │
│                                             │
│   ┌─ Schedule Config Panel ──────────────┐  │  ← appears when a scheduled
│   │  (see §3 for details)                │  │     trigger is selected
│   └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 2.2 Category Card Styling

```tsx
<Card className="border-l-4 border-l-amber-500">
  <CardHeader>
    <CardTitle className="text-base">Scheduled</CardTitle>
  </CardHeader>
  <CardContent className="space-y-3">
    {scheduledTriggers.map((triggerMeta) => (
      <label key={triggerMeta.type} className="flex items-start gap-3 cursor-pointer">
        <input
          type="radio"
          name="trigger"
          value={triggerMeta.type}
          checked={trigger.type === triggerMeta.type}
          onChange={(e) => handleTriggerTypeChange(e.target.value)}
          className="mt-0.5 h-4 w-4 cursor-pointer text-accent-brand focus:ring-accent-brand"
        />
        <div className="flex-1 space-y-2">
          <span className="text-sm">{triggerMeta.label}</span>
          {trigger.type === triggerMeta.type && (
            <ScheduleConfigPanel
              triggerType={trigger.type}
              schedule={trigger.schedule}
              onScheduleChange={handleScheduleChange}
            />
          )}
        </div>
      </label>
    ))}
  </CardContent>
</Card>
```

### 2.3 Info Tooltip — Client-Side Limitations

Below the "Scheduled" card title, add a subtle info line:

```tsx
<CardHeader>
  <CardTitle className="text-base">Scheduled</CardTitle>
  <p className="text-xs text-muted-foreground mt-1">
    Runs when the app is open. Missed schedules catch up on next visit.
  </p>
</CardHeader>
```

This addresses Architecture §7.4 and PM §4.11 — transparent communication about client-side constraints without a heavy tooltip or modal. The phrasing is casual and non-alarming.

---

## 3. Schedule Configuration Panel

The `ScheduleConfigPanel` is a new component that renders inline below the selected scheduled trigger radio button. It adapts its fields based on the trigger type.

### 3.1 Interval Configuration

**Trigger type**: `scheduled_interval`
**User sees**: "Every [number] [unit]"

```
┌─ Schedule ───────────────────────────────────┐
│                                              │
│  Every  [ 30  ▾]  [ minutes ▾]              │
│                                              │
│  ℹ️ Minimum: 5 minutes. Maximum: 7 days.     │
└──────────────────────────────────────────────┘
```

**Components**:
- Number input: `<Input type="number" min={5} max={10080} />` — but the displayed range depends on the unit
- Unit select: `<Select>` with options: "minutes", "hours", "days"
- The number input range adjusts when the unit changes:
  - minutes: 5–60
  - hours: 1–168 (7 days)
  - days: 1–7

**Conversion**: The UI stores the user's chosen unit for display, but the schema value is always `intervalMinutes`. Conversion happens on change:
- minutes → `value`
- hours → `value * 60`
- days → `value * 1440`

**Validation**: Zod schema enforces `min(5).max(10080)`. The UI prevents out-of-range values via input constraints. If the user types a value outside the range, show inline error text in `text-destructive` below the input.

### 3.2 Cron Configuration (Structured)

**Trigger type**: `scheduled_cron`
**User sees**: A time picker + day selector with tabs for "Daily", "Weekly", "Monthly"

```
┌─ Schedule ───────────────────────────────────┐
│                                              │
│  ┌─────────┬─────────┬──────────┐            │
│  │  Daily  │ Weekly  │ Monthly  │  ← Tabs    │
│  └─────────┴─────────┴──────────┘            │
│                                              │
│  At  [ 09 ▾] : [ 00 ▾]                      │
│                                              │
│  ── Daily tab (no day selector) ──           │
│  Runs every day at the specified time.       │
│                                              │
│  ── Weekly tab ──                            │
│  ┌───┬───┬───┬───┬───┬───┬───┐              │
│  │ S │ M │ T │ W │ T │ F │ S │  ← Toggle    │
│  │   │ ● │   │   │   │ ● │   │    buttons   │
│  └───┴───┴───┴───┴───┴───┴───┘              │
│  Runs on selected days.                      │
│                                              │
│  ── Monthly tab ──                           │
│  On day  [ 1 ▾]  of the month               │
│  (Values > 28 fire on last day in            │
│   short months)                              │
│                                              │
└──────────────────────────────────────────────┘
```

**Components**:
- **Tabs**: Use shadcn `<Tabs>` component. Three tabs: Daily, Weekly, Monthly. These are UI modes — all map to `scheduled_cron` with different field values.
- **Time picker**: Two `<Select>` dropdowns — hour (00–23) and minute (00, 05, 10, ..., 55). Minute increments of 5 reduce choice overload while covering practical use cases. The user can type a custom minute if needed.
- **Day-of-week toggles** (Weekly tab): 7 circular toggle buttons (S M T W T F S). Each is a `<button>` with `aria-pressed`. Selected state: `bg-accent-brand text-white`. Unselected: `bg-muted text-muted-foreground`. Minimum 44×44px touch target.
- **Day-of-month select** (Monthly tab): `<Select>` with values 1–31. Show helper text: "Values > 28 fire on last day in short months" (addresses Architecture §14.2 Decision 4 — last-day-of-month fix).

**Tab → Schema mapping**:
- Daily: `{ daysOfWeek: [], daysOfMonth: [] }` (empty arrays = every day)
- Weekly: `{ daysOfWeek: [selected days], daysOfMonth: [] }`
- Monthly: `{ daysOfWeek: [], daysOfMonth: [selected day] }`

**Weekday shortcut**: On the Weekly tab, add a "Weekdays" quick-select button that toggles Mon–Fri (indices 1–5). This covers PM US-4 (daily standup on weekdays) with one click.

### 3.3 Due-Date-Relative Configuration

**Trigger type**: `scheduled_due_date_relative`
**User sees**: "[number] [unit] [before/after] due date"

```
┌─ Schedule ───────────────────────────────────┐
│                                              │
│  [ 2  ]  [ days ▾]  [ before ▾]  due date   │
│                                              │
│  ℹ️ Checks all tasks with due dates on each  │
│     evaluation tick.                         │
└──────────────────────────────────────────────┘
```

**Components**:
- Number input: `<Input type="number" min={1} />`
- Unit select: `<Select>` with "minutes", "hours", "days"
- Direction select: `<Select>` with "before", "after"

**Conversion**: The UI stores display values. The schema value is `offsetMinutes`:
- before → negative: `-(value * unitMultiplier)`
- after → positive: `value * unitMultiplier`
- Unit multipliers: minutes=1, hours=60, days=1440

**Validation**: `offsetMinutes` is an integer (Architecture §2.2). The UI prevents fractional values via `step={1}` on the number input.

### 3.4 Filter Requirement Warning

Per Architecture §14.2 Decision 1: interval/cron triggers with task-targeting actions require ≥1 filter. The UI enforces this at the Action step (step 2), not the Trigger step. When the user reaches the Review step with a scheduled interval/cron trigger, a task-targeting action, and zero filters:

```
┌─ Warning ────────────────────────────────────┐
│ ⚠️ This rule will affect ALL tasks in the    │
│ project on every run. Add a filter to scope  │
│ it down.                                     │
│                                              │
│ [Add Filter]  [Continue Anyway]              │
└──────────────────────────────────────────────┘
```

This is a warning, not a blocker — the user can override. `create_card` actions skip this warning (no tasks to filter on).

---

## 4. Review Step — Scheduled Trigger Flow Diagram

The Review step's flow diagram changes structure for scheduled triggers. Event triggers use "WHEN → IF → THEN". Scheduled triggers use "EVERY → IF → THEN".

### 4.1 Scheduled Rule Review Layout

```
┌─ EVERY ──────────────────────────────────────┐
│ 🟠 border-l-amber-500                        │
│                                              │
│ Every Monday at 09:00                        │
│                                              │
└──────────────────────────────────────────────┘
         ↓
┌─ IF (optional) ──────────────────────────────┐
│ 🟣 border-l-purple-500                       │
│                                              │
│ [is overdue] [not in section "Urgent"]       │
│                                              │
└──────────────────────────────────────────────┘
         ↓
┌─ THEN ───────────────────────────────────────┐
│ 🔵 border-l-sky-500                          │
│                                              │
│ Move to top of "Urgent"                      │
│                                              │
└──────────────────────────────────────────────┘
```

**Key change**: The first card says "EVERY" instead of "WHEN" and uses amber border. The description uses the schedule-specific format from Architecture Appendix B:
- Interval: "Every 30 minutes"
- Cron daily: "Daily at 09:00"
- Cron weekly: "Mon, Fri at 09:00"
- Cron monthly: "1st of month at 09:00"
- Due-date-relative: "2 days before due date"

### 4.2 Preview Sentence

The preview bar at the bottom of the wizard changes sentence structure for scheduled triggers (Architecture Appendix C):

- Event: "When a card in Backlog is marked complete, move to top of Done"
- Scheduled: "Every Monday at 09:00, for cards that are overdue and not in Urgent, move to top of Urgent"

The "for cards" phrasing makes it clear that the rule scans multiple tasks, unlike event triggers which act on a single entity.

---

## 5. Rule Card — Scheduled Rule Variant

### 5.1 Visual Differentiation

Scheduled rules need to be visually distinct from event-driven rules in the AutomationTab list. The existing RuleCard uses trigger/action category badges. Scheduled rules get:

- **Amber trigger badge**: `border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300`
- **Schedule indicator**: A small clock icon (Lucide `Clock`) next to the rule name
- **Next run time**: Below the stats line, show "Next: Mon at 09:00" or "Next: in 23 minutes"

```
┌─────────────────────────────────────────────────┐
│ ⠿  🕐 Weekly Sprint Grooming          [on/off] │
│                                           ⋮     │
│ Every Mon at 09:00, for cards that are overdue  │
│ and in Backlog, move to top of This Week        │
│                                                 │
│ [🟠 at a specific time] → [🔵 move to section] │
│                                                 │
│ Ran 12 times · Last fired 3d ago                │
│ Next: Mon at 09:00 (in 2 days)                  │
│                                                 │
│ ▸ Execution log                                 │
└─────────────────────────────────────────────────┘
```

### 5.2 "Next Run" Calculation

The "Next: ..." line is computed client-side from the schedule config and `lastEvaluatedAt`. For each trigger type:

- **Interval**: `lastEvaluatedAt + intervalMinutes` → format as relative time ("in 23 minutes") or absolute ("at 10:30 AM")
- **Cron**: Walk forward from `now` to find the next matching window → format as "Mon at 09:00 (in 2 days)"
- **Due-date-relative**: "Checks on next tick" (no specific next time — depends on task due dates)

This is a display-only computation — no new state needed. Implement as a pure function `computeNextRunDescription(trigger, now)` in `rulePreviewService.ts`.

### 5.3 Catch-Up Indicator

When a scheduled rule fires on catch-up (app was closed), the execution log entry should show a "Catch-up" badge:

```
▸ Execution log
  🔄 Catch-up · Mon 09:00 · Moved 12 tasks to "This Week"
  ⚡ Scheduled · Fri 09:00 · Moved 8 tasks to "This Week"
```

The `🔄` prefix and "Catch-up" label distinguish catch-up executions from regular scheduled runs. This maps to the `isCatchUp` flag in `SchedulerService.tick()` (Architecture §3.3).

### 5.4 Aggregated Execution Log Entry

Per Architecture §14.2 Decision 11, scheduled executions use aggregated log entries:

```
▸ Execution log
  ⚡ Mon 09:00 · Moved 50 tasks to "This Week"
  ⚡ Mon 09:00 (prev week) · Moved 42 tasks to "This Week"
```

Each entry shows the schedule description, timestamp, and `matchCount`. Clicking an entry could expand to show the first 10 task names from the `details` array (Phase 5b enhancement).

### 5.5 "Run Now" Button

Per Architecture §14.2 Decision 8, scheduled rules get a "Run Now" button in the RuleCard dropdown menu:

```
┌─────────────┐
│ Edit        │
│ Run Now     │  ← NEW for scheduled rules only
│ Duplicate ▸ │
│ Delete      │
└─────────────┘
```

"Run Now" calls `schedulerService.tickRule(ruleId)` with `clock.now()`. It shows a confirmation toast: "⚡ [Rule Name] ran manually, affecting N tasks." The execution log entry is tagged as "Manual" instead of "Scheduled" or "Catch-up".

---

## 6. Notification Design

### 6.1 Summary Toast (Architecture §8)

When multiple scheduled rules fire in one tick, a single summary toast replaces per-rule toasts:

```
┌─────────────────────────────────────────────┐
│ ⚡ 5 scheduled rules ran, affecting 32 tasks │
│                                [View log →] │
└─────────────────────────────────────────────┘
```

- Position: bottom-right (Sonner default)
- Duration: 8 seconds (longer than the 5s default — gives the user time to notice background activity)
- Action button: "View log" navigates to the Automation tab
- No undo button on summary toasts (undo is per-rule, not per-batch)

### 6.2 Single-Rule Toast

When exactly 1 scheduled rule fires:

```
┌─────────────────────────────────────────────┐
│ ⚡ Weekly Grooming ran on 12 tasks           │
│                          [Undo]  [Dismiss]  │
└─────────────────────────────────────────────┘
```

- Same format as existing event-driven rule toasts
- Undo button present (30-second window for scheduled rules, per Architecture §14.2 Decision 6)
- Only shown when `document.visibilityState === 'visible'` and `!isCatchUp`

### 6.3 Catch-Up Toast

When the app reopens and catch-up fires:

```
┌─────────────────────────────────────────────┐
│ 🔄 Caught up: 3 scheduled rules ran,        │
│    affecting 45 tasks              [View →] │
└─────────────────────────────────────────────┘
```

- Distinct prefix "🔄 Caught up:" makes it clear these are missed runs
- No undo button (user wasn't present when the rules should have fired)
- Duration: 10 seconds (longer — the user just opened the app and needs time to orient)

### 6.4 Toast Styling

All scheduled trigger toasts use the existing toast infrastructure (Sonner or custom). No new toast variants needed — just different message content and duration.

Color coding in the toast message:
- `⚡` for regular scheduled execution (matches existing automation toast prefix)
- `🔄` for catch-up execution (new — visually distinct)
- `🔧` for manual "Run Now" execution (new)

> Note: These are Unicode characters, not emoji-as-icons. They're used in text content, not as UI icons. The pre-delivery checklist rule "no emojis as icons" applies to interactive UI elements (buttons, badges), not inline text prefixes.

---

## 7. Client-Side Limitations Messaging

### 7.1 Trigger Step Info Line

Already covered in §2.3. A single line below the "Scheduled" card title:

> "Runs when the app is open. Missed schedules catch up on next visit."

### 7.2 Rule Card "Last Ran" Indicator

The existing "Last fired" stat on RuleCard already shows staleness. For scheduled rules, enhance it:

- Normal: "Last fired 2h ago" (same as event rules)
- Stale: "Last fired 3d ago · ⚠️ Missed 2 runs" — amber warning when `lastEvaluatedAt` is significantly behind the expected schedule

The "Missed N runs" count is computed from `(now - lastEvaluatedAt) / intervalMs` for interval rules, or by counting missed cron windows for cron rules. This is a display-only computation.

### 7.3 Detailed Tooltip (on hover/focus of the info icon)

For users who want more detail, add an info icon (`Lucide Info`) next to the "Scheduled" card title that shows a tooltip on hover:

```
┌─────────────────────────────────────────────────┐
│ Scheduled rules run on a timer while the app    │
│ is open in your browser.                        │
│                                                 │
│ • If the app is closed, rules don't fire in     │
│   real-time — they catch up when you reopen.    │
│ • Background tabs may delay rules until you     │
│   switch back.                                  │
│ • Timing is approximate (±1 minute).            │
│ • Only one browser tab runs scheduled rules.    │
└─────────────────────────────────────────────────┘
```

Use shadcn `<Tooltip>` with `<TooltipContent className="max-w-xs">`. The tooltip is accessible via keyboard focus on the info icon button.

---

## 8. Run Now Button

### 8.1 Location

In the RuleCard's `<DropdownMenu>`, between "Edit" and "Duplicate":

```tsx
{isScheduledTrigger(rule.trigger) && (
  <DropdownMenuItem onClick={() => onRunNow(rule.id)}>
    <Play className="h-4 w-4 mr-2" />
    Run now
  </DropdownMenuItem>
)}
```

Uses Lucide `Play` icon. Only visible for scheduled rules (event rules don't have a "run now" concept — they fire on events).

### 8.2 Confirmation Flow

No confirmation dialog — "Run Now" is non-destructive (same as a scheduled tick). The result is shown via toast:

```
🔧 Weekly Grooming ran manually, affecting 8 tasks
```

### 8.3 Loading State

While the rule is executing (synchronous, but could take a moment for large task sets):

1. The "Run now" menu item shows a spinner
2. After completion, the RuleCard's stats update immediately (executionCount, lastExecutedAt)
3. Toast appears with results

---

## 9. Accessibility Audit

### 9.1 Trigger Step

- Radio buttons have associated `<label>` elements (existing pattern — maintained)
- Schedule config panel inputs have `<Label htmlFor>` associations
- Day-of-week toggle buttons use `aria-pressed` for toggle state
- Time picker selects have `aria-label="Hour"` and `aria-label="Minute"`
- Tab navigation within the cron config uses shadcn `<Tabs>` which handles `role="tablist"`, `role="tab"`, `role="tabpanel"`, arrow key navigation

### 9.2 Day-of-Week Toggles

```tsx
<div role="group" aria-label="Days of week">
  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
    <button
      key={index}
      type="button"
      role="switch"
      aria-checked={selectedDays.includes(index)}
      aria-label={day}
      onClick={() => toggleDay(index)}
      className={`h-10 w-10 rounded-full text-sm font-medium transition-colors
        ${selectedDays.includes(index)
          ? 'bg-accent-brand text-white'
          : 'bg-muted text-muted-foreground hover:bg-muted/80'
        }`}
    >
      {day.charAt(0)}
    </button>
  ))}
</div>
```

- `role="group"` with `aria-label` for the container
- Each button is `role="switch"` with `aria-checked`
- Minimum 40×40px (close to 44px touch target — acceptable with 4px gap between buttons)
- Color is not the only indicator — `aria-checked` provides state to screen readers

### 9.3 Review Step

- "EVERY" card is clickable (navigates to Trigger step) — has `cursor-pointer` and `hover:bg-accent/50`
- Screen reader announcement: "Step 4 of 4: Review" via `aria-live="polite"` region (existing pattern)

### 9.4 Toast Notifications

- Summary toast: `role="status"` `aria-live="polite"` (existing Sonner behavior)
- Catch-up toast: same accessibility attributes
- "View log" action button is keyboard-focusable

### 9.5 Reduced Motion

- Day-of-week toggle transitions use `transition-colors` (color only, no layout shift)
- Tab switching uses shadcn's built-in reduced-motion support
- No custom animations added — all transitions are ≤200ms color/opacity changes

---

## 10. Responsive Behavior

### 10.1 Schedule Config Panel — Mobile (< 640px)

The cron config panel stacks vertically on mobile:

```
┌─ Schedule ──────────────────┐
│                             │
│ [Daily] [Weekly] [Monthly]  │  ← Tabs (full width)
│                             │
│ At  [09 ▾] : [00 ▾]        │  ← Time picker (inline)
│                             │
│ ┌─┬─┬─┬─┬─┬─┬─┐            │
│ │S│M│T│W│T│F│S│            │  ← Day toggles (fit in row)
│ └─┴─┴─┴─┴─┴─┴─┘            │
└─────────────────────────────┘
```

- Day toggles: 7 buttons at ~40px each = 280px + gaps. Fits within 320px viewport with 16px padding each side.
- Time picker: hour and minute selects are inline (not stacked)
- Tabs: full-width, text labels visible (not truncated)

### 10.2 Interval Config — Mobile

```
Every  [30 ▾]  [minutes ▾]
```

Single row — fits easily on mobile. Number input is narrow (4 characters max).

### 10.3 Due-Date-Relative Config — Mobile

```
[2]  [days ▾]  [before ▾]  due date
```

Single row on desktop. On mobile (< 400px), wraps to two rows:

```
[2]  [days ▾]  [before ▾]
due date
```

### 10.4 Rule Card — Mobile

The "Next: Mon at 09:00 (in 2 days)" line wraps naturally. No special mobile handling needed — it's a single text line.

---

## 11. Component Inventory

### 11.1 New Components

| Component | Location | Responsibility |
|-----------|----------|---------------|
| `ScheduleConfigPanel` | `components/ScheduleConfigPanel.tsx` | Renders interval/cron/due-date config based on trigger type |
| `ScheduleConfigPanel.test.tsx` | `components/ScheduleConfigPanel.test.tsx` | Component tests |
| `CronDayPicker` | Internal to `ScheduleConfigPanel` | Day-of-week toggle buttons (not exported separately) |
| `TimePicker` | Internal to `ScheduleConfigPanel` | Hour + minute select dropdowns (not exported separately) |

### 11.2 Modified Components

| Component | Changes |
|-----------|---------|
| `RuleDialogStepTrigger.tsx` | Add "Scheduled" category card with 3 radio options + inline `ScheduleConfigPanel` |
| `RuleDialogStepReview.tsx` | "EVERY" card variant for scheduled triggers (amber border, schedule description) |
| `RuleCard.tsx` | Clock icon, "Next run" line, amber badge, "Run Now" in dropdown, catch-up indicator in log |
| `RuleCardExecutionLog.tsx` | Aggregated entry display with `matchCount`, catch-up/manual badges |
| `AutomationTab.tsx` | Update `MAX_RULES_WARNING_THRESHOLD` from 10 to 12 (new scheduled rule limit) |
| `RuleDialog.tsx` | Handle `schedule` field in trigger state, pass to `ScheduleConfigPanel`, update save handler to include schedule config |
| `RulePreview.tsx` | Render scheduled trigger preview sentence ("Every [schedule], for cards...") |

### 11.3 Existing Components Used (No Changes)

| Component | Usage |
|-----------|-------|
| `Card`, `CardHeader`, `CardContent`, `CardTitle` | Schedule category card, review step cards |
| `Badge` | Amber trigger badge on RuleCard |
| `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent` | Daily/Weekly/Monthly mode switcher |
| `Select`, `SelectTrigger`, `SelectContent`, `SelectItem` | Time picker, unit picker, direction picker |
| `Input` | Number inputs for interval value, offset value |
| `Label` | Form labels for all inputs |
| `Tooltip`, `TooltipTrigger`, `TooltipContent` | Client-side limitations info tooltip |
| `Switch` | Rule enable/disable (unchanged) |
| `DropdownMenu` | "Run Now" menu item |

---

## 12. Interaction Specifications

### 12.1 Trigger Type Selection → Schedule Config Reveal

1. User clicks a scheduled trigger radio button (e.g., "at a specific time")
2. The `ScheduleConfigPanel` slides in below the radio label with `transition-all duration-200`
3. Focus moves to the first input in the panel (hour select for cron, number input for interval)
4. If the user switches to a different scheduled trigger type, the panel morphs to the new config (no close/reopen animation — just content swap)
5. If the user switches to an event trigger, the panel collapses with `transition-all duration-150`

### 12.2 Cron Tab Switching

1. User selects "at a specific time" trigger
2. Default tab: "Daily" (simplest — no day selection needed)
3. User clicks "Weekly" tab → day-of-week toggles appear below the time picker
4. User clicks "Monthly" tab → day-of-month select appears below the time picker
5. Switching tabs preserves the time picker values (hour/minute don't reset)
6. Switching from Weekly to Daily clears `daysOfWeek` (set to `[]`)
7. Switching from Monthly to Daily clears `daysOfMonth` (set to `[]`)

### 12.3 Day-of-Week Toggle Interaction

1. User clicks a day button → toggles its selected state
2. At least one day must be selected when in Weekly mode. If the user deselects the last day, show inline validation: "Select at least one day"
3. "Weekdays" quick-select button: toggles Mon–Fri. If all 5 are already selected, deselects all 5 (toggle behavior).
4. Visual feedback: selected days have `bg-accent-brand text-white`, unselected have `bg-muted text-muted-foreground`

### 12.4 Wizard Flow for Scheduled Triggers

The 4-step wizard flow is unchanged. Scheduled triggers follow the same Trigger → Filters → Action → Review path.

**Filters step behavior for scheduled triggers**: The Filters step is always shown for scheduled triggers (unlike section-level event triggers which skip it). This is because scheduled triggers always operate on tasks, and filters are the primary scoping mechanism.

**Validation at each step**:
- Step 0 (Trigger): Valid when a trigger type is selected AND the schedule config is complete (all required fields filled)
- Step 1 (Filters): Always valid (empty filters = match all tasks). Warning shown at Review step if empty + task-targeting action.
- Step 2 (Action): Same as event triggers
- Step 3 (Review): Same as event triggers, plus the filter warning for scheduled rules

### 12.5 Save Handler Changes

The `handleSave` in `RuleDialog.tsx` needs to include the schedule config in the trigger object:

```typescript
// For scheduled triggers, include schedule + lastEvaluatedAt
const triggerPayload = isScheduledTriggerType(trigger.type)
  ? {
      type: trigger.type,
      sectionId: null,
      schedule: trigger.schedule,
      lastEvaluatedAt: editingRule?.trigger?.lastEvaluatedAt ?? null,
    }
  : {
      type: trigger.type!,
      sectionId: trigger.sectionId,
    };
```

When editing an existing scheduled rule, preserve `lastEvaluatedAt` from the existing rule (don't reset it — the user is editing the config, not resetting the schedule).

When creating a new scheduled rule, `lastEvaluatedAt` starts as `null` (first tick will fire immediately — Architecture §3.2).

---

## 13. Cross-Doc References

This UI/UX analysis is designed to be cohesive with the other three analysis documents:

| UI/UX Section | Architecture Reference | PM Reference | QA Reference |
|---------------|----------------------|--------------|--------------|
| §2 Trigger Step | §2.1 New Trigger Types, Appendix A (metadata) | §2.1 Schedule Types | §1 Scenarios (trigger configs) |
| §3 Schedule Config Panel | §2.2 Schedule Config Schemas | §2.2 Data Model | §5 Test Scenarios (schema validation) |
| §3.2 Cron Config | §2.2 `CronScheduleSchema` | §2.1 "At a specific time" | §5.B Cron evaluation tests |
| §3.4 Filter Warning | §14.2 Decision 1 (action-dependent filter req) | §9.2 Decision 1 | §5.D Filter interaction tests |
| §4 Review Step | Appendix C (preview service extension) | — | — |
| §5 Rule Card | Appendix B (trigger descriptions) | §4.11 UX messaging | §5.G State consistency tests |
| §5.2 Next Run | — (display-only computation) | §6.2 Reliability metrics | — |
| §5.5 Run Now | §14.2 Decision 8 | §9.1 Q4 | §5.E5 (tick is callable) |
| §6 Notifications | §8 Notification Strategy | §4.9 Notification strategy | §10 Decision 8 |
| §6.3 Catch-Up Toast | §3.3 `isCatchUp` flag | §4.2 Catch-up behavior | §4.1 Catch-up expectations |
| §7 Limitations | §7.4 Honest Limitations | §4.11 User expectations | §4 Reliability expectations |
| §8 Run Now | §14.2 Decision 8 | §9.1 Q4 | §5.E3 (start runs immediate tick) |
| §9 Accessibility | — | — | — (new, UI-specific) |
| §10 Responsive | — | — | — (new, UI-specific) |

### Updates Made to Other Docs

To maintain cohesion, the following cross-references were verified:

1. **Architecture Appendix A** — `TriggerMeta` entries for scheduled triggers include `category: 'scheduled'` which maps to the amber color in the UI. Verified.
2. **Architecture Appendix C** — Preview sentence structure for scheduled triggers ("Every [schedule], for cards [filters], [action]") matches §4.2 of this doc. Verified.
3. **PM §4.9** — Notification strategy (summary toast) matches §6.1 of this doc. Verified.
4. **PM §4.11** — Client-side limitations messaging matches §7 of this doc. Verified.
5. **QA §10 Decision 8** — Notification strategy threshold (>1 rule → summary) matches §6.1. Verified.
6. **Architecture §14.2 Decision 8** — "Run Now" in Phase 5a matches §8 of this doc. Verified.

---

## Appendix A: Color System Summary

| Category | Border Color | Badge Colors | Usage |
|----------|-------------|-------------|-------|
| Card Move | `border-l-blue-500` | `border-blue-500 bg-blue-500/10 text-blue-700` | Existing event triggers |
| Card Change | `border-l-emerald-500` | `border-emerald-500 bg-emerald-500/10 text-emerald-700` | Existing event triggers |
| Section Change | `border-l-violet-500` | `border-violet-500 bg-violet-500/10 text-violet-700` | Existing event triggers |
| **Scheduled** | `border-l-amber-500` | `border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300` | **New** — all 3 scheduled trigger types |

Dark mode variants use the `dark:` prefix with 300-weight colors for text (e.g., `dark:text-amber-300`).

## Appendix B: Execution Log Entry Badges

| Badge | Color | Usage |
|-------|-------|-------|
| ⚡ Scheduled | Default (no special badge) | Regular scheduled execution |
| 🔄 Catch-up | `bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-400` | Catch-up execution on app reopen |
| 🔧 Manual | `bg-blue-100 dark:bg-blue-950/30 text-blue-700 dark:text-blue-400` | "Run Now" manual execution |

## Appendix C: Scheduled Trigger Metadata for UI

```typescript
// Addition to TRIGGER_CATEGORY_COLORS in RuleCard.tsx
const TRIGGER_CATEGORY_COLORS: Record<string, string> = {
  card_move: 'border-blue-500 bg-blue-500/10 text-blue-700 dark:text-blue-300',
  card_change: 'border-emerald-500 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  section_change: 'border-violet-500 bg-violet-500/10 text-violet-700 dark:text-violet-300',
  scheduled: 'border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-300', // NEW
};
```
