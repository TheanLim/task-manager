---
name: testing
description: Keep tests green on every code change
inclusion: always
---

# Testing Rules

## Update Tests With Every Change

When modifying any source file that has a co-located or related test file, update the tests in the same pass:
- Add tests for new behavior, remove tests for deleted behavior, fix tests broken by refactors.
- Look for test files matching `*.test.ts`, `*.test.tsx` next to the source or in the same feature folder.
- If a changed module has no tests yet, note it but don't create tests unless the user asks.

## Run Tests After Every Change

After finishing edits (source + tests), run the relevant test suite:
- Single file: `npx vitest run <path-to-test-file>`
- Broader changes: `npx vitest run`
- E2E-impacting changes: mention that `npm run test:e2e` should be run manually.

Fix any failures before considering the task done. If a test fails, diagnose and fix the root cause — don't delete or skip the test.

## Conventions

- Unit tests: Vitest + React Testing Library + fast-check
- E2E tests: Playwright (in `e2e/`)
- Use `vitest run` (single execution), never watch mode
