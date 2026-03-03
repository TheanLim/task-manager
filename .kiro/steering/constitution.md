---
inclusion: always
---
# Task Management App

Client-side Next.js + Zustand + Tailwind task manager with feature-based architecture, per-entity repositories, Zod schemas, and a service layer for all business logic.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (static export) |
| Language | TypeScript (strict mode) |
| State | Zustand 4 with persist middleware |
| Styling | Tailwind CSS 3 + shadcn/ui (Radix primitives) |
| Validation | Zod 4 |
| Storage | localStorage via per-entity repositories |
| Testing | Vitest + React Testing Library + fast-check |
| E2E | Playwright |
| Rich text | react-quill-new |
| DnD | @dnd-kit |
| Dates | date-fns |

## Quality Standards

- Type-safe everywhere — strict TypeScript, no `any` at boundaries (except test mocks)
- Zod validation for all domain entities — `z.string().min(1)` for IDs (not `.uuid()`)
- Service layer owns all business logic — stores are UI state + read-through caches
- Every new `.ts`/`.tsx` with logic gets a co-located test file
- All tests pass (`npx vitest run`) and lint clean (`npm run lint`) before done

## Build & Run

```
npm run dev          # Next.js dev server
npm run build        # Production build (catches SWC/Webpack errors)
npm run lint         # ESLint
npx vitest run       # Unit tests (single execution)
npx playwright test  # E2E tests
```

## Project Structure

```
app/              → Next.js app router (layout, page, hooks, globals)
components/       → Shared UI components (shadcn/ui in components/ui/)
features/         → Feature modules (automations, keyboard, projects, sharing, tasks, tms)
lib/              → Shared infra (schemas, serviceContainer, events, repositories)
stores/           → Global Zustand stores (appStore, dataStore)
types/            → Domain types (re-exported from Zod schemas)
e2e/              → Playwright E2E tests
```

## Key Conventions

- Feature modules: `features/{name}/` with components/, services/, hooks/, types.ts, index.ts
- Barrel exports: each feature has `index.ts`; service sub-modules have their own barrels
- Entity construction: centralized in services, never in components
- Domain events: `lib/events/` → consumed by `automationService.handleEvent()`
- Composition root: `lib/serviceContainer.ts` — all DI wiring happens here

## Key Files

| Area | Files |
|------|-------|
| Entry point | `app/page.tsx`, `app/layout.tsx` |
| Config | `package.json`, `tsconfig.json`, `tailwind.config.ts`, `next.config.js` |
| Domain types | `types/index.ts`, `lib/schemas.ts` |
| Composition root | `lib/serviceContainer.ts` |
| Global stores | `stores/dataStore.ts`, `stores/appStore.ts` |
| Repositories | `lib/repositories/types.ts`, `lib/repositories/localStorageRepositories.ts` |
| Domain events | `lib/events/types.ts`, `lib/events/domainEvents.ts` |
