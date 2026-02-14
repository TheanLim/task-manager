---
name: skill-orchestration
inclusion: always
description: When to activate meta skills during normal work
---

# Skill Orchestration

## Auto-Activate These Skills When Context Matches

- Creating/updating a skill → activate `skill-creator`, then `skill-evaluator` to review, then `skill-taxonomy-designer` to classify
- User reports a skill failed or produced bad output → activate `self-improving-skill-loop`
- Onboarding a new codebase or planning automation → activate `skill-gap-analyzer`
- Skill library growing, major project change, or quarterly check-in → activate `skill-lifecycle-manager`

## Chaining Rules

1. After any skill is created or updated, always run `skill-evaluator` before considering it done
2. After `skill-evaluator` scores below 3/5, offer to run `self-improving-skill-loop`
3. After `skill-gap-analyzer` suggests new skills, use `skill-taxonomy-designer` to classify and name them
4. After 5+ skills exist, proactively suggest a `skill-lifecycle-manager` audit
