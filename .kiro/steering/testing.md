---
name: testing
description: Keep tests green on every code change
inclusion: always
---

# Testing Rules

## Update Tests With Every Change

When modifying any source file with a co-located test file (`*.test.ts`, `*.test.tsx`), update tests in the same pass. If a changed module has no tests yet, note it but don't create tests unless asked.

**Cross-file modifications**: When implementing a feature that modifies multiple existing files (e.g., adding integration points, wiring up services), identify ALL modified files and update their tests. Don't just test new files—test every file you touch.

## Before Marking Work Complete

Run this checklist:

1. **Identify modified files**: List all files changed (not just created) during implementation
2. **Check for test files**: For each modified file, verify if a `.test.ts` or `.test.tsx` exists
3. **Update tests**: For each modified file with tests, add tests covering the new/changed behavior
4. **Run tests**: Execute `npx vitest run` and verify all tests pass
5. **Run lint**: Execute `npm run lint` and fix any issues

## Run Tests After Every Change

After edits, run `npx vitest run` (single file or broad). For e2e-impacting changes, run `npm run test:e2e`. Fix failures before marking done.

## Conventions

- Unit tests: Vitest + React Testing Library + fast-check
- E2E tests: Playwright (in `e2e/`)
- Use `vitest run` (single execution), never watch mode

## Mocking Guidelines

- **Don't implement classes** — When mocking a class dependency, don't use `implements ClassName`. Classes have properties that mocks don't need.
- **Cast at boundaries** — Use `as any` when passing mocks to constructors/functions expecting the real type. This is pragmatic in tests.
- **Keep mocks minimal** — Only implement methods actually called in tests. Don't over-engineer full implementations.
- **In-memory repositories** — Use `Map<string, T>` for mock repositories. Provides isolation and clear/reset between tests.
- **Fast-check type assertions** — When arbitraries generate broad types (e.g., `string | null`), cast generated data (`as any`) when passing to strictly-typed functions.

## jsdom Limitations

- `scrollIntoView`, `getBoundingClientRect` don't exist in jsdom — use optional chaining in hooks/effects.
- When a hook exposes a consumer API (like `getCellProps`), verify the consumer actually calls it.
