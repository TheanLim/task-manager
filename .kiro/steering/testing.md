---
name: testing
description: Keep tests green on every code change
inclusion: always
---

# Testing Rules

- Modify a file with a `.test.*` → update its tests in the same pass
- Create a new `.ts`/`.tsx` with logic → create a co-located test file in the same commit (includes extraction/refactoring)
- Existing file has no tests → note it, don't create unless asked
- Cross-file changes → identify ALL modified files, update every test you touch

## Before Marking Work Complete

1. List all changed + new `.ts`/`.tsx` files — each new file with logic needs a test
2. For each modified file with tests, add tests covering new/changed behavior
3. Run `npx vitest run` — all pass
4. Run `npm run lint` — fix issues
5. If any `.tsx` component files were changed, run `npx next build` — catches SWC/Webpack errors that vitest and lint miss

## Conventions

- Vitest + React Testing Library + fast-check; Playwright for e2e (`e2e/`)
- Use `vitest run` (single execution), never watch mode

## Mocking

- Cast mocks with `as any` at boundaries; keep mocks minimal; use `Map<string, T>` for in-memory repos
- jsdom: `scrollIntoView`/`getBoundingClientRect` don't exist — use optional chaining
