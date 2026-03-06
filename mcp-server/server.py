"""
Context7 MCP Server — Task Management App

Provides subsystem discovery, context document search, and agent routing
for AI coding agents working in this codebase.
"""

from pathlib import Path
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("context7")

# Workspace root — resolved relative to this file's location
WORKSPACE_ROOT = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# SUBSYSTEMS — one entry per major module/directory
# ---------------------------------------------------------------------------

SUBSYSTEMS: dict[str, dict] = {
    "core-infrastructure": {
        "name": "Core Infrastructure",
        "description": "Persistence layer, Zod validation, domain events, service wiring (composition root). Foundation for all features.",
        "keywords": [
            "repository", "localStorage", "persistence", "schema", "zod",
            "validation", "serviceContainer", "composition root", "domain event",
            "backend",
        ],
        "files": [
            "lib/serviceContainer.ts",
            "lib/schemas.ts",
            "lib/validation.ts",
            "lib/utils.ts",
            "lib/events/domainEvents.ts",
            "lib/events/types.ts",
            "lib/repositories/types.ts",
            "lib/repositories/localStorageBackend.ts",
            "lib/repositories/localStorageRepositories.ts",
            "lib/README.md",
            "lib/DATA-FLOW.md",
            "lib/DECISIONS.md",
            ".kiro/context/core-infrastructure.md",
        ],
    },
    "stores": {
        "name": "Zustand Stores",
        "description": "Top-level Zustand state management. dataStore (entity cache + CRUD) and appStore (UI preferences). Plus feature-level stores (tmsStore, filterStore, keyboardNavStore).",
        "keywords": [
            "zustand", "store", "state", "dataStore", "appStore", "persist",
            "settings", "theme", "sort", "column", "tmsStore", "filterStore",
            "keyboardNavStore", "subscription", "dual-write",
        ],
        "files": [
            "stores/dataStore.ts",
            "stores/appStore.ts",
            "features/tms/stores/tmsStore.ts",
            "features/tasks/stores/filterStore.ts",
            "features/keyboard/stores/keyboardNavStore.ts",
            "stores/README.md",
            ".kiro/context/stores.md",
            ".kiro/context/core-infrastructure.md",
        ],
    },
    "automations": {
        "name": "Automations",
        "description": "Rule-based automation engine. Event triggers, scheduled triggers, filters, actions, cascade execution, undo, preview.",
        "keywords": [
            "automation", "rule", "trigger", "action", "filter", "scheduler",
            "cron", "interval", "cascade", "undo", "dry-run", "rule engine",
            "scheduled", "one-time", "due date",
        ],
        "files": [
            "features/automations/services/automationService.ts",
            "features/automations/services/evaluation/ruleEngine.ts",
            "features/automations/services/evaluation/filterPredicates.ts",
            "features/automations/services/execution/actionHandlers.ts",
            "features/automations/services/execution/ruleExecutor.ts",
            "features/automations/services/scheduler/schedulerService.ts",
            "features/automations/services/scheduler/scheduleEvaluator.ts",
            "features/automations/services/preview/rulePreviewService.ts",
            "features/automations/services/rules/brokenRuleDetector.ts",
            "features/automations/services/rules/ruleFactory.ts",
            "features/automations/services/rules/dryRunService.ts",
            "features/automations/schemas.ts",
            "features/automations/types.ts",
            "features/automations/components/wizard/RuleDialog.tsx",
            "features/automations/components/AutomationTab.tsx",
            "features/automations/README.md",
            "features/automations/ARCHITECTURE.md",
            "features/automations/EXTENDING.md",
            ".kiro/context/automations.md",
        ],
    },
    "tasks": {
        "name": "Tasks",
        "description": "Task CRUD, hierarchy (parent/subtask), dependencies, sorting, filtering, and view modes (list, board, calendar).",
        "keywords": [
            "task", "subtask", "dependency", "sort", "filter", "list",
            "board", "kanban", "calendar", "drag", "dnd-kit", "cascade delete",
            "cascade complete", "priority", "due date", "tags",
        ],
        "files": [
            "features/tasks/components/TaskList.tsx",
            "features/tasks/components/TaskBoard.tsx",
            "features/tasks/components/TaskCalendar.tsx",
            "features/tasks/components/TaskDetailPanel.tsx",
            "features/tasks/components/TaskDialog.tsx",
            "features/tasks/components/TaskRow.tsx",
            "features/tasks/components/GlobalTasksView.tsx",
            "features/tasks/services/taskService.ts",
            "features/tasks/services/taskSortService.ts",
            "features/tasks/services/dependencyResolver.ts",
            "features/tasks/services/dependencyService.ts",
            "features/tasks/hooks/useFilteredTasks.ts",
            "features/tasks/stores/filterStore.ts",
            "features/tasks/README.md",
            "features/tasks/DECISIONS.md",
            ".kiro/context/tasks.md",
        ],
    },
    "projects": {
        "name": "Projects",
        "description": "Project CRUD, sections, tabbed views (Overview, List, Board, Calendar, Automations). Cascade delete orchestration.",
        "keywords": [
            "project", "section", "view", "tab", "overview", "cascade",
            "default sections", "project service", "section service",
        ],
        "files": [
            "features/projects/components/ProjectView.tsx",
            "features/projects/components/ProjectList.tsx",
            "features/projects/components/ProjectDialog.tsx",
            "features/projects/components/SectionManager.tsx",
            "features/projects/components/ProjectTabs.tsx",
            "features/projects/services/projectService.ts",
            "features/projects/services/sectionService.ts",
            "features/projects/README.md",
            "features/projects/DECISIONS.md",
            ".kiro/context/projects.md",
        ],
    },
    "sharing": {
        "name": "Sharing",
        "description": "URL sharing (LZMA compression), JSON import/export, replace/merge workflows, deduplication.",
        "keywords": [
            "share", "import", "export", "lzma", "compress", "url",
            "base64", "merge", "replace", "deduplicate", "json",
        ],
        "files": [
            "features/sharing/services/shareService.ts",
            "features/sharing/services/importExport.ts",
            "features/sharing/services/deduplicateData.ts",
            "features/sharing/hooks/useSharedStateLoader.ts",
            "features/sharing/components/ShareButton.tsx",
            "features/sharing/components/SharedStateDialog.tsx",
            "features/sharing/components/ImportExportMenu.tsx",
            "features/sharing/README.md",
            ".kiro/context/sharing.md",
        ],
    },
    "tms": {
        "name": "Time Management Systems",
        "description": "Pluggable task-ordering strategies: Standard, Do It Tomorrow (DIT), Autofocus 4 (AF4), Final Version Perfected (FVP).",
        "keywords": [
            "tms", "time management", "dit", "af4", "fvp", "autofocus",
            "do it tomorrow", "final version perfected", "handler",
            "ordering", "strategy",
        ],
        "files": [
            "features/tms/handlers/",
            "features/tms/stores/tmsStore.ts",
            "features/tms/components/TMSSelector.tsx",
            "features/tms/components/DITView.tsx",
            "features/tms/components/AF4View.tsx",
            "features/tms/components/FVPView.tsx",
            "features/tms/index.ts",
            "features/tms/README.md",
            ".kiro/context/tms.md",
        ],
    },
    "keyboard": {
        "name": "Keyboard Navigation",
        "description": "Grid-based keyboard navigation, 21 shortcut actions, customizable bindings, vim keys, shortcut settings UI.",
        "keywords": [
            "keyboard", "shortcut", "navigation", "grid", "vim", "hotkey",
            "keybinding", "focus", "arrow", "shortcut settings",
        ],
        "files": [
            "features/keyboard/services/shortcutService.ts",
            "features/keyboard/services/gridNavigationService.ts",
            "features/keyboard/hooks/useKeyboardNavigation.ts",
            "features/keyboard/hooks/useGlobalShortcuts.ts",
            "features/keyboard/stores/keyboardNavStore.ts",
            "features/keyboard/components/ShortcutHelpOverlay.tsx",
            "features/keyboard/components/ShortcutSettings.tsx",
            "features/keyboard/README.md",
            ".kiro/context/keyboard.md",
        ],
    },
    "ui-shared": {
        "name": "Shared UI",
        "description": "Shared components (Layout, Breadcrumb, ErrorBoundary, ThemeProvider), shadcn/ui primitives, global CSS, theme system, app-level hooks.",
        "keywords": [
            "layout", "breadcrumb", "theme", "dark mode", "shadcn", "radix",
            "ui", "component", "error boundary", "skeleton", "empty state",
            "inline editable", "search input", "css variables", "animation",
            "typography", "font", "elevation", "shadow", "responsive",
            "mobile", "sidebar", "toaster", "sonner",
        ],
        "files": [
            "app/layout.tsx",
            "app/page.tsx",
            "app/globals.css",
            "app/quill-custom.css",
            "app/hooks/useHydrated.ts",
            "app/hooks/useMediaQuery.ts",
            "app/hooks/useCrossTabSync.ts",
            "app/hooks/useDialogManager.ts",
            "components/Layout.tsx",
            "components/Breadcrumb.tsx",
            "components/ErrorBoundary.tsx",
            "components/ThemeProvider.tsx",
            "components/ThemeToggle.tsx",
            "components/EmptyState.tsx",
            "components/LandingEmptyState.tsx",
            "components/InlineEditable.tsx",
            "components/SearchInput.tsx",
            "components/SkeletonProjectList.tsx",
            "components/SkeletonTaskList.tsx",
            "components/ui/",
            "lib/utils.ts",
            "tailwind.config.ts",
            ".kiro/context/ui-shared.md",
        ],
    },
    "e2e-tests": {
        "name": "E2E Tests",
        "description": "Playwright end-to-end test suite with 273 tests across 15 spec files. localStorage seeding, Chromium-only, fully parallel.",
        "keywords": [
            "e2e", "playwright", "test", "integration", "browser",
            "spec", "fixture", "seed", "keyboard", "automation",
            "scheduled", "global", "views",
        ],
        "files": [
            "e2e/keyboard-shortcuts.spec.ts",
            "e2e/scheduled-triggers.spec.ts",
            "e2e/global-automations-phase2.spec.ts",
            "e2e/subtask-nav-and-settings.spec.ts",
            "e2e/all-tasks-controls.spec.ts",
            "e2e/seeded-views.spec.ts",
            "e2e/automation-rules.spec.ts",
            "e2e/global-automations.spec.ts",
            "e2e/global-tasks.spec.ts",
            "e2e/seeded-global-tasks.spec.ts",
            "e2e/project-management.spec.ts",
            "e2e/task-management.spec.ts",
            "e2e/task-views.spec.ts",
            "e2e/app-layout.spec.ts",
            "e2e/share-dialog.spec.ts",
            "e2e/fixtures/seed-data.ts",
            "e2e/fixtures/scheduled-triggers-seed.ts",
            "playwright.config.ts",
            ".kiro/context/e2e-tests.md",
        ],
    },
}

# ---------------------------------------------------------------------------
# AGENTS — one entry per .kiro/agents/*.md
# ---------------------------------------------------------------------------

AGENTS: dict[str, dict] = {
    "agent-factory": {
        "name": "Agent Factory",
        "description": "Creates new specialized agents with domain knowledge, codebase exploration, and project registration.",
        "triggers": [
            "create agent", "new agent", "agent factory", "specialized agent",
            "agent architect", "build agent",
        ],
        "model": "sonnet",
    },
    "constitution-factory": {
        "name": "Constitution Factory",
        "description": "Creates/updates the project constitution steering file with architecture, conventions, and agent triggers.",
        "triggers": [
            "constitution", "steering", "project constitution", "create constitution",
            "update constitution", "steering file",
        ],
        "model": "sonnet",
    },
    "context-factory": {
        "name": "Context Factory",
        "description": "Creates .kiro/context/ system blueprint documents with MCP registration and cross-referencing.",
        "triggers": [
            "context doc", "context document", "system blueprint", "create context",
            "new context", "documentation", "context factory",
        ],
        "model": "sonnet",
    },
    "automations-engineer": {
        "name": "Automations Engineer",
        "description": "Domain expert for the automations rule engine — triggers, filters, actions, cascade execution, scheduler, evaluation pipeline, preview/dry-run, and wizard UI.",
        "triggers": [
            "automation", "rule engine", "trigger", "action handler", "filter predicate",
            "scheduler", "cascade execution", "undo automation", "dry-run", "scheduled rule",
            "cron", "interval", "broken rule", "rule wizard", "global rule",
        ],
        "model": "opus",
    },
}


# ---------------------------------------------------------------------------
# Tool implementations
# ---------------------------------------------------------------------------

@mcp.tool()
def list_subsystems() -> str:
    """Return all subsystem names and descriptions."""
    lines = []
    for key, sub in SUBSYSTEMS.items():
        lines.append(f"- **{key}**: {sub['description']}")
    return "\n".join(lines)


@mcp.tool()
def get_files_for_subsystem(subsystem: str) -> str:
    """Return key file paths for a subsystem.

    Args:
        subsystem: Subsystem key (e.g. 'automations', 'tasks', 'core-infrastructure')
    """
    sub = SUBSYSTEMS.get(subsystem)
    if not sub:
        available = ", ".join(SUBSYSTEMS.keys())
        return f"Unknown subsystem '{subsystem}'. Available: {available}"
    lines = [f"# {sub['name']}", f"{sub['description']}", "", "## Key Files"]
    for f in sub["files"]:
        lines.append(f"- `{f}`")
    return "\n".join(lines)


@mcp.tool()
def find_relevant_context(task_description: str) -> str:
    """Match a task description to relevant subsystems and files.

    Args:
        task_description: Natural language description of what you're working on
    """
    task_lower = task_description.lower()
    scored: list[tuple[str, dict, int]] = []

    for key, sub in SUBSYSTEMS.items():
        score = 0
        for kw in sub["keywords"]:
            if kw.lower() in task_lower:
                score += 2 if " " in kw else 1
        if score > 0:
            scored.append((key, sub, score))

    scored.sort(key=lambda x: x[2], reverse=True)

    if not scored:
        return "No matching subsystems found. Try broader terms or use list_subsystems()."

    lines = [f"## Relevant subsystems for: '{task_description}'", ""]
    for key, sub, score in scored[:5]:
        lines.append(f"### {key} (relevance: {score})")
        lines.append(sub["description"])
        lines.append("Key files:")
        for f in sub["files"][:5]:
            lines.append(f"  - `{f}`")
        lines.append("")

    return "\n".join(lines)


@mcp.tool()
def search_context_documents(query: str) -> str:
    """Full-text search across .kiro/context/ documents.

    Args:
        query: Search term or phrase
    """
    context_dir = WORKSPACE_ROOT / ".kiro" / "context"
    if not context_dir.exists():
        return "No .kiro/context/ directory found. Context documents have not been created yet."

    query_lower = query.lower()
    results = []

    for md_file in sorted(context_dir.glob("*.md")):
        try:
            content = md_file.read_text(encoding="utf-8")
        except Exception:
            continue
        if query_lower in content.lower():
            # Extract first non-empty line as title
            title = md_file.stem
            for line in content.splitlines():
                stripped = line.strip().lstrip("#").strip()
                if stripped:
                    title = stripped
                    break
            # Find matching lines with context
            matches = []
            for i, line in enumerate(content.splitlines()):
                if query_lower in line.lower():
                    matches.append(f"  L{i+1}: {line.strip()[:120]}")
                    if len(matches) >= 3:
                        break
            results.append(
                f"### {md_file.name}\n**{title}**\n" + "\n".join(matches)
            )

    if not results:
        return f"No matches for '{query}' in .kiro/context/ documents."

    return f"## Search results for '{query}'\n\n" + "\n\n".join(results)


@mcp.tool()
def get_context_files() -> str:
    """List all context documents in .kiro/context/."""
    context_dir = WORKSPACE_ROOT / ".kiro" / "context"
    if not context_dir.exists():
        return "No .kiro/context/ directory found. Context documents have not been created yet."

    files = sorted(context_dir.glob("*.md"))
    if not files:
        return "No context documents found in .kiro/context/."

    lines = [f"## Context Documents ({len(files)} files)", ""]
    for f in files:
        try:
            content = f.read_text(encoding="utf-8")
            title = f.stem
            for line in content.splitlines():
                stripped = line.strip().lstrip("#").strip()
                if stripped:
                    title = stripped
                    break
        except Exception:
            title = f.stem
        lines.append(f"- `{f.name}` — {title}")

    return "\n".join(lines)


@mcp.tool()
def suggest_agent(task_description: str) -> str:
    """Match a task description to the recommended agent.

    Args:
        task_description: Natural language description of what you need to do
    """
    task_lower = task_description.lower()
    scored: list[tuple[str, dict, int]] = []

    for key, agent in AGENTS.items():
        score = 0
        for trigger in agent["triggers"]:
            if trigger.lower() in task_lower:
                score += 2 if " " in trigger else 1
        if score > 0:
            scored.append((key, agent, score))

    scored.sort(key=lambda x: x[2], reverse=True)

    if not scored:
        return "No matching agent found. Available agents:\n" + "\n".join(
            f"- `{k}`: {a['description']}" for k, a in AGENTS.items()
        )

    best_key, best_agent, _ = scored[0]
    lines = [
        f"## Recommended: `{best_key}`",
        f"**{best_agent['name']}** ({best_agent['model']})",
        best_agent["description"],
    ]

    if len(scored) > 1:
        lines.append("\nAlso relevant:")
        for key, agent, _ in scored[1:]:
            lines.append(f"- `{key}`: {agent['description']}")

    return "\n".join(lines)


@mcp.tool()
def list_agents() -> str:
    """Return all agents with descriptions and models."""
    lines = ["## Available Agents", ""]
    for key, agent in AGENTS.items():
        lines.append(
            f"- **`{key}`** ({agent['model']}): {agent['description']}"
        )
        lines.append(f"  Triggers: {', '.join(agent['triggers'])}")
    return "\n".join(lines)


if __name__ == "__main__":
    mcp.run()
