<!-- v1 | last-verified: 2025-07-14 -->
# Shared UI & Theme System

Shared components, shadcn/ui primitives, global CSS variables, and the theme system that underpin every feature module. All visual consistency — colors, typography, elevation, animations, dark mode — flows from this subsystem.

## Overview

The UI layer follows a three-tier architecture:

| Tier | Location | Purpose |
|------|----------|---------|
| Primitives | `components/ui/` | shadcn/ui Radix wrappers — zero business logic, Tailwind-styled |
| Shared components | `components/` | App-level shells: Layout, Breadcrumb, ErrorBoundary, skeletons, empty states |
| App shell | `app/layout.tsx` | Next.js root — fonts, providers (ErrorBoundary → ThemeProvider → Toaster) |

Design decisions: warm amber brand palette (`hsl(38 92% 50%)`), DM Sans + JetBrains Mono fonts, HSL CSS variables for all colors, `class`-based dark mode via ThemeProvider (not `next-themes` — custom implementation backed by `appStore.settings.theme`).

## Theme System

### Provider Chain

```
app/layout.tsx
  └─ ErrorBoundary          (class component, catches render errors)
       └─ ThemeProvider      (reads appStore.settings.theme, applies class to <html>)
            └─ {children}
            └─ Toaster       (sonner, bottom-right, richColors)
```

### ThemeProvider Implementation

- Reads `theme` from `appStore.settings` (persisted in localStorage)
- Applies `light` / `dark` class to `document.documentElement`
- Listens to `prefers-color-scheme` media query when `theme === 'system'`
- Exposes `useTheme()` hook → `{ theme, setTheme, actualTheme }`

Critical: ThemeProvider does NOT use `next-themes`. It's a custom implementation that delegates persistence to `appStore`. Don't import from `next-themes` in app code — only `components/ui/sonner.tsx` imports it (shadcn default, reads theme for Sonner toast styling).

### CSS Variables (globals.css)

All colors use HSL format without `hsl()` wrapper — consumed as `hsl(var(--name))` in Tailwind config.

| Variable | Light | Dark | Purpose |
|----------|-------|------|---------|
| `--background` | `40 20% 98%` | `220 15% 8%` | Page background |
| `--foreground` | `220 15% 10%` | `40 10% 90%` | Primary text |
| `--card` | `40 15% 96%` | `220 13% 12%` | Card/sidebar bg |
| `--accent-brand` | `38 92% 50%` | `38 92% 50%` | Brand amber (same both modes) |
| `--accent-brand-hover` | `38 92% 42%` | `38 92% 58%` | Brand hover (darker light, lighter dark) |
| `--accent-brand-muted` | `38 40% 70%` | `38 30% 35%` | Subdued brand |
| `--destructive` | `0 72% 51%` | `0 72% 51%` | Error/delete red |
| `--ring` | `38 92% 50%` | `38 92% 50%` | Focus ring = brand amber |
| `--border` | `40 10% 88%` | `220 13% 18%` | Borders |
| `--muted` | `40 10% 93%` | `220 13% 16%` | Muted backgrounds |
| `--surface-raised` | `40 12% 94%` | `220 13% 12%` | Raised surface |
| `--elevation-base` | `40 10% 50% / 0.04` | `220 20% 4% / 0.4` | Shadow base |

Custom variables beyond shadcn defaults: `--accent-brand`, `--accent-brand-hover`, `--accent-brand-muted`, `--destructive-hover`, `--surface-raised`, `--surface-overlay`, `--elevation-*`.

### Tailwind Extensions (tailwind.config.ts)

| Extension | Values |
|-----------|--------|
| `fontFamily` | `sans: var(--font-sans)`, `mono: var(--font-mono)` |
| `colors.accent-brand` | `hsl(var(--accent-brand) / <alpha-value>)` |
| `colors.priority-*` | `high: hsl(38 92% 50%)`, `medium: 40% opacity`, `low: 20% opacity` |
| `boxShadow.elevation-*` | `base`, `raised`, `overlay` — warm-toned shadows |
| `borderRadius` | `lg: var(--radius)`, `md: calc(var(--radius) - 2px)`, `sm: calc(var(--radius) - 4px)` |
| `animation` | `check-pop`, `fade-in-up`, `slide-in-right`, `slide-out-right`, `accordion-*` |
| `darkMode` | `["class"]` |

### Typography

| Element | Font | Weight | Extra |
|---------|------|--------|-------|
| Body | DM Sans (`--font-sans`) | 400 | — |
| h1 | DM Sans | 700 | `letter-spacing: -0.025em` |
| h2, h3 | DM Sans | 600 | `letter-spacing: -0.025em` |
| Code, kbd, pre | JetBrains Mono (`--font-mono`) | — | — |

Fonts loaded via `next/font/google` in `app/layout.tsx` as CSS variables.

## Shared Components

### Layout

Responsive shell with collapsible sidebar, header bar, and main content area.

| Feature | Implementation |
|---------|---------------|
| Sidebar toggle | `sidebarOpen` state, hamburger `Menu` icon in header |
| Desktop sidebar | Sliding panel with CSS transform, resizable (drag handle, 200–600px) |
| Mobile sidebar | Fixed overlay drawer with backdrop, body scroll lock, auto-close on nav |
| Breakpoint | `useMediaQuery('(max-width: 1023px)')` → `isMobile` |
| Cross-tab sync | `useCrossTabSync()` rehydrates Zustand stores on `storage` events |
| Header slots | `breadcrumb`, `searchInput`, `header` (right-aligned actions) |
| Focus management | Auto-focus first interactive element when sidebar opens; Escape returns focus to toggle |

Props: `children`, `sidebar?`, `header?`, `breadcrumb?`, `searchInput?`

### Breadcrumb

URL-driven breadcrumb using `useSearchParams()`. Defers rendering until `useHydrated()` returns true to avoid SSR mismatch with Zustand store data.

| URL State | Breadcrumb |
|-----------|------------|
| `?view=tasks` | "All Tasks" |
| `?project={id}` | "{Project Name}" |
| `?project={id}&tab=board` | "{Project Name}" → "Board" |

### ErrorBoundary

Class component wrapping the entire app. On error: shows Card with AlertTriangle icon, error details in `<details>`, "Go Home" and "Reload Page" buttons. Logs to `console.error`.

### ThemeToggle

Dropdown menu (Sun/Moon/Monitor icons) → calls `useTheme().setTheme()`. Sun icon rotates/scales to Moon on dark mode via CSS transitions.

### EmptyState

Generic empty state with configurable icon, title, description, and optional action button. Uses `accent-brand` for the action button.

### LandingEmptyState

Shown when no project is selected. "Create Project" (brand button) + "Import from JSON" (outline). Shows keyboard shortcut hint (`?`).

### InlineEditable

Click-to-edit text component using `contentEditable` span. Supports validation via `ValidationError`, Enter to save, Escape to cancel, blur to save. Accessible: `role="textbox"`, `aria-invalid`, `aria-describedby`.

### SearchInput

Header search with `⌘K` keyboard shortcut to focus. Currently placeholder ("upcoming" label). Fires `onSearch` callback on input change.

### Skeleton Components

| Component | Rows | Purpose |
|-----------|------|---------|
| `SkeletonProjectList` | 5 | Sidebar placeholder during SSR hydration |
| `SkeletonTaskList` | 8 | Main content placeholder during SSR hydration |

Both use `animate-pulse` on `bg-muted` elements, `aria-busy="true"`, `aria-label` for accessibility.

## shadcn/ui Primitives

21 primitives in `components/ui/`, all Radix-based with Tailwind styling via `cn()` utility.

| Primitive | Radix Package | Notes |
|-----------|--------------|-------|
| `alert-dialog` | `@radix-ui/react-alert-dialog` | Confirm/cancel dialogs |
| `badge` | — | Variant-based span |
| `button` | `@radix-ui/react-slot` | 6 variants × 4 sizes via `cva` |
| `calendar` | `react-day-picker` | Date picker |
| `card` | — | Container with card bg/shadow |
| `checkbox` | `@radix-ui/react-checkbox` | — |
| `command` | `cmdk` | Command palette |
| `dialog` | `@radix-ui/react-dialog` | Modal with overlay + close button |
| `dropdown-menu` | `@radix-ui/react-dropdown-menu` | — |
| `input` | — | Styled `<input>` |
| `label` | `@radix-ui/react-label` | — |
| `popover` | `@radix-ui/react-popover` | — |
| `radio-group` | `@radix-ui/react-radio-group` | — |
| `select` | `@radix-ui/react-select` | — |
| `separator` | `@radix-ui/react-separator` | — |
| `sonner` | `sonner` + `next-themes` | Toast notifications (only `next-themes` consumer) |
| `switch` | `@radix-ui/react-switch` | — |
| `tabs` | `@radix-ui/react-tabs` | — |
| `textarea` | — | Styled `<textarea>` |
| `toast` | — | Custom toast (legacy, app uses Sonner) |
| `tooltip` | `@radix-ui/react-tooltip` | — |

### Button Variants

| Variant | Style |
|---------|-------|
| `default` | `bg-primary` solid |
| `destructive` | `bg-destructive` solid |
| `outline` | Border + transparent bg |
| `secondary` | `bg-secondary` |
| `ghost` | Transparent, hover bg |
| `link` | Underline on hover |

Sizes: `default` (h-9), `sm` (h-8), `lg` (h-10), `icon` (h-9 w-9).

### cn() Utility

```typescript
// lib/utils.ts
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Used by every shadcn primitive and most shared components for conditional class merging.

## App-Level Hooks

| Hook | Location | Purpose |
|------|----------|---------|
| `useHydrated` | `app/hooks/useHydrated.ts` | Returns `false` during SSR, `true` after hydration. Guards client-only UI. |
| `useMediaQuery` | `app/hooks/useMediaQuery.ts` | Subscribes to CSS media query. Returns `false` during SSR. |
| `useCrossTabSync` | `app/hooks/useCrossTabSync.ts` | Listens for `storage` events, rehydrates dataStore/appStore/tmsStore. |
| `useDialogManager` | `app/hooks/useDialogManager.ts` | Centralized dialog/panel state for page.tsx (project, task, dependency, shared state, task detail panel, toasts). |

Critical: `useHydrated` and `useMediaQuery` both return `false` on first render to prevent SSR hydration mismatches. Components that depend on client state (Breadcrumb, Layout mobile detection) must gate rendering on these hooks.

## Global CSS Features

### Scrollbar Utilities

| Class | Effect |
|-------|--------|
| `scrollbar-none` | Hides scrollbar completely |
| `scrollbar-thin` | 8px width/height scrollbar |
| `scrollbar-thumb-gray-300` | Light mode thumb color |
| `scrollbar-track-gray-100` | Light mode track color |

Dark mode variants auto-apply via `.dark` parent selector.

### Keyboard Navigation Styles

```css
[data-grid-row][data-grid-col].grid-cell-active {
  box-shadow: inset 0 0 0 2px hsl(var(--accent-brand));
  background: hsl(var(--accent-brand) / 0.05);
}
tr[data-kb-active="true"] {
  box-shadow: inset 0 0 0 2px hsl(var(--accent-brand));
}
```

### Accessibility

- `prefers-reduced-motion: reduce` → disables all animations (duration → 0.01ms)
- Skeleton components use `aria-busy="true"` + `aria-label`
- InlineEditable uses `role="textbox"`, `aria-invalid`, `aria-describedby`
- Layout sidebar uses `aria-hidden`, `inert` when closed
- `html, body { overflow: hidden }` — all scrolling handled by inner containers

### Quill Editor Styles

`app/quill-custom.css` — theme-aware overrides for react-quill-new. Toolbar, editor, content elements all use CSS variables. Read-only mode strips borders/padding.

## Unused Components

`components/_unused/` contains 3 deprecated components kept for reference:

| Component | Was | Replaced By |
|-----------|-----|-------------|
| `FilterPanel.tsx` | Sidebar filter panel | `filterStore` + inline filter UI |
| `SearchBar.tsx` | Full search bar | `SearchInput` (compact header version) |
| `ViewModeSelector.tsx` | View mode buttons | `ProjectTabs` (tab-based navigation) |

## Testing

### Existing Tests

| Test File | Covers |
|-----------|--------|
| `components/Breadcrumb.test.tsx` | Breadcrumb rendering |
| `components/LandingEmptyState.test.tsx` | Empty state actions |
| `components/SearchInput.test.tsx` | Search input + ⌘K shortcut |
| `components/SkeletonProjectList.test.tsx` | Skeleton rendering |
| `components/SkeletonTaskList.test.tsx` | Skeleton rendering |
| `app/hooks/useDialogManager.test.ts` | Dialog state management |
| `app/hooks/useHydrated.test.ts` | Hydration hook |
| `app/hooks/useMediaQuery.test.ts` | Media query hook |
| `app/globals.test.ts` | CSS variable presence |

### Manual Test Scenarios

1. Theme toggle: Light → Dark → System → verify all CSS variables apply
2. Mobile sidebar: Resize below 1024px → hamburger menu → drawer opens → backdrop click closes
3. Sidebar resize: Drag handle between 200–600px → verify content reflows
4. Cross-tab sync: Open 2 tabs → change theme in tab A → verify tab B updates
5. Error boundary: Throw in a component → verify error card renders with "Go Home" / "Reload"

## Key Files

| File | Description |
|------|-------------|
| `app/layout.tsx` | Root layout — fonts, provider chain |
| `app/globals.css` | CSS variables, base styles, utilities |
| `app/quill-custom.css` | Quill editor theme overrides |
| `components/Layout.tsx` | Responsive shell with sidebar |
| `components/Breadcrumb.tsx` | URL-driven breadcrumb |
| `components/ErrorBoundary.tsx` | App-wide error boundary |
| `components/ThemeProvider.tsx` | Theme context + `useTheme` hook |
| `components/ThemeToggle.tsx` | Theme dropdown menu |
| `components/EmptyState.tsx` | Generic empty state |
| `components/LandingEmptyState.tsx` | No-project landing page |
| `components/InlineEditable.tsx` | Click-to-edit text |
| `components/SearchInput.tsx` | Header search with ⌘K |
| `components/SkeletonProjectList.tsx` | Sidebar loading skeleton |
| `components/SkeletonTaskList.tsx` | Content loading skeleton |
| `components/ui/` | 21 shadcn/ui primitives |
| `lib/utils.ts` | `cn()` class merge utility |
| `tailwind.config.ts` | Theme extensions, animations |
| `app/hooks/useHydrated.ts` | SSR hydration guard |
| `app/hooks/useMediaQuery.ts` | CSS media query hook |
| `app/hooks/useCrossTabSync.ts` | Cross-tab store rehydration |
| `app/hooks/useDialogManager.ts` | Centralized dialog state |

## References

### Source Files
- `app/layout.tsx` — Root layout with provider chain
- `app/globals.css` — All CSS variables and base styles
- `app/quill-custom.css` — Quill rich text editor theming
- `components/Layout.tsx` — Responsive sidebar layout
- `components/ThemeProvider.tsx` — Custom theme provider (not next-themes)
- `tailwind.config.ts` — Extended color palette, animations, shadows
- `lib/utils.ts` — cn() utility used by all UI components

### Related Context Docs
- [stores.md](stores.md) — appStore persists theme preference; dataStore entities rendered by shared components
