---
name: testing
description: Keep tests green on every code change
inclusion: always
---

# Testing Rules

## Update Tests With Every Change

When modifying any source file with a co-located test file (`*.test.ts`, `*.test.tsx`), update tests in the same pass. If a changed module has no tests yet, note it but don't create tests unless asked.

## Run Tests After Every Change

After edits, run `npx vitest run` (single file or broad). For e2e-impacting changes, run `npm run test:e2e`. Fix failures before marking done.

## Conventions

- Unit tests: Vitest + React Testing Library + fast-check
- E2E tests: Playwright (in `e2e/`)
- Use `vitest run` (single execution), never watch mode

## jsdom Limitations

- `scrollIntoView`, `getBoundingClientRect` don't exist in jsdom — use optional chaining in hooks/effects.
- When a hook exposes a consumer API (like `getCellProps`), verify the consumer actually calls it.
