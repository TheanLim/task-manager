---
name: edit-steering-docs
inclusion: auto
description: Guidelines for creating, editing, or organizing steering docs and playbooks
---

# Steering Doc Conventions

## Line Limits

Exceeding these degrades Kiro response quality.

| Mode | Max lines | Examples |
|---|---|---|
| always | 30 | `rules.md` |
| auto | 60 | `edit-steering-docs.md` |
| manual | 60–80 | deep-dive playbooks |

## Core Principles

- 20:80 rule — keep docs short and focused on the 20% of guidance that drives 80% of correct behavior.
- Use `auto` inclusion with a clear `description` so docs load only when relevant.
- Use `always` sparingly — only for short, universally needed rules.
- Use `manual` for deep-dive docs you'll reference explicitly with `#` in chat.
- One source of truth — never duplicate info across docs. Reference, don't repeat.
- Keep each doc modular — one concern per file. Split rather than grow.
- Use verbs for playbook filenames: `build.md`, `add-platform.md`, `run-tests.md`.
- Use `#[[file:path]]` for source file references. Verify paths exist before committing.

## Scaling Patterns

As the repo grows, use these patterns to keep context lean:

- `architecture.md` (manual) — system diagrams, data flow, API contracts, deployment topology.
- `context.md` (always) — background the agent should always know (keep very short).
- `research.md` (manual) — collected research, notes, insights for ongoing investigations.
- `map.md` (manual) — for large refactors, map out all files/symbols affected before starting.
- Feature-specific guides: `pattern-<name>.md` (auto) with descriptive `description` fields.

## Adding a New Steering Doc

1. Create `.kiro/steering/<name>.md`.
2. Pick the right inclusion mode: `always` for universal rules, `auto` for topic-specific, `manual` for deep-dives.
3. Write a clear `description` in front-matter — this is what Kiro matches against for `auto` docs.

## Tools

- Use code-cerebro (`analyze_file_structure`, `search_symbol`, `locate_symbol_usages`) to explore the codebase before writing or updating docs.
- Run `wc -l` to verify line counts before committing.

## Anti-Patterns

Add anti-patterns to `rules.md`, not to playbooks. Rules are always loaded; playbooks are not.
