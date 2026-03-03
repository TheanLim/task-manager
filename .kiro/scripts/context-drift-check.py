#!/usr/bin/env python3
"""
Context Drift Detection for Kiro IDE.

Checks recent git commits for code changes without corresponding
steering doc updates. Reads subsystem-map.json for the code→doc mapping.

Output goes to stdout and is injected into the agent's context via hook.
Empty output = no warnings (silent).

Usage:
    python3 .kiro/scripts/context-drift-check.py
    python3 .kiro/scripts/context-drift-check.py --dismiss
"""

import json
import os
import subprocess
import sys
from pathlib import Path

MAX_COMMITS = 10
DISMISS_MAX_SHOWS = 2
STATE_FILE = ".kiro/scripts/.drift-state.json"


def find_repo_root() -> Path | None:
    """Find git repo root from script location."""
    script_dir = Path(__file__).resolve().parent
    # Script lives at .kiro/scripts/ so repo root is 2 levels up
    candidate = script_dir.parent.parent
    if (candidate / ".git").exists():
        return candidate
    cwd = Path.cwd()
    if (cwd / ".git").exists():
        return cwd
    return None


def load_subsystem_map(repo_root: Path) -> dict:
    """Load subsystem-map.json."""
    map_path = repo_root / ".kiro" / "scripts" / "subsystem-map.json"
    if not map_path.exists():
        return {}
    try:
        data = json.loads(map_path.read_text(encoding="utf-8"))
        return data.get("subsystems", {})
    except (json.JSONDecodeError, OSError):
        return {}


def get_head_sha(repo_root: Path) -> str | None:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            capture_output=True, text=True, timeout=2, cwd=repo_root,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return None


def load_state(repo_root: Path) -> dict:
    state_path = repo_root / STATE_FILE
    if state_path.exists():
        try:
            return json.loads(state_path.read_text())
        except (json.JSONDecodeError, OSError):
            pass
    return {}


def save_state(repo_root: Path, state: dict) -> None:
    state_path = repo_root / STATE_FILE
    try:
        state_path.parent.mkdir(parents=True, exist_ok=True)
        state_path.write_text(json.dumps(state))
    except OSError:
        pass


def detect_drift(repo_root: Path, subsystems: dict) -> list:
    """Check recent commits for code changes without doc updates."""
    if not subsystems:
        return []

    try:
        result = subprocess.run(
            ["git", "log", f"--max-count={MAX_COMMITS}", "--name-only", "--format=%H"],
            capture_output=True, text=True, timeout=5, cwd=repo_root,
        )
        if result.returncode != 0:
            return []
    except (subprocess.TimeoutExpired, FileNotFoundError):
        return []

    # Parse changed files from recent commits
    all_changed_files = set()
    all_changed_docs = set()
    for line in result.stdout.strip().split("\n"):
        line = line.strip()
        if not line or (len(line) == 40 and all(c in "0123456789abcdef" for c in line)):
            continue
        all_changed_files.add(line)
        if line.startswith(".kiro/steering/") and line.endswith(".md"):
            all_changed_docs.add(os.path.basename(line))

    # Check each subsystem
    flagged = []
    for key, info in subsystems.items():
        code_patterns = info.get("codePatterns", [])
        steering_docs = info.get("steeringDocs", [])
        priority = info.get("priority", "MEDIUM")

        if priority == "LOW":
            continue

        # Check if any code files matching this subsystem changed
        matched_code = []
        for changed_file in all_changed_files:
            for pattern in code_patterns:
                if pattern.endswith("/"):
                    if changed_file.startswith(pattern):
                        matched_code.append(changed_file)
                        break
                elif changed_file == pattern or changed_file.endswith("/" + pattern):
                    matched_code.append(changed_file)
                    break

        if not matched_code:
            continue

        # Check if corresponding docs were also updated
        missing_docs = [d for d in steering_docs if d not in all_changed_docs]
        if missing_docs:
            flagged.append({
                "subsystem": key,
                "priority": priority,
                "code_files": sorted(matched_code)[:3],
                "expected_docs": missing_docs[:3],
            })

    return flagged


def format_output(drift: list, times_shown: int = 0) -> str:
    parts = []
    if not drift:
        return ""

    remaining = max(0, DISMISS_MAX_SHOWS - times_shown)
    note = f"(showing {times_shown}/{DISMISS_MAX_SHOWS} — auto-dismisses after {remaining} more)"

    high = [d for d in drift if d.get("priority") == "HIGH"]
    medium = [d for d in drift if d.get("priority") == "MEDIUM"]

    if high:
        lines = [f"CONTEXT DRIFT [HIGH — auto-update recommended] {note}:"]
        for item in high[:3]:
            code = ", ".join(os.path.basename(f) for f in item["code_files"][:2])
            docs = ", ".join(item["expected_docs"][:3])
            lines.append(f"  - {item['subsystem']} ({code}) -> update: {docs}")
        parts.append("\n".join(lines))

    if medium:
        lines = [f"CONTEXT DRIFT [MEDIUM — mention to user] {note}:"]
        for item in medium[:3]:
            code = ", ".join(os.path.basename(f) for f in item["code_files"][:2])
            docs = ", ".join(item["expected_docs"][:3])
            lines.append(f"  - {item['subsystem']} ({code}) -> consider: {docs}")
        parts.append("\n".join(lines))

    return "\n\n".join(parts)


def main():
    try:
        repo_root = find_repo_root()
        if not repo_root:
            return

        if "--dismiss" in sys.argv:
            head = get_head_sha(repo_root)
            if head:
                save_state(repo_root, {"head_sha": head, "times_shown": DISMISS_MAX_SHOWS})
                print(f"Drift warnings dismissed at {head[:8]}.")
            return

        subsystems = load_subsystem_map(repo_root)
        drift = detect_drift(repo_root, subsystems)

        # Deduplicate docs across subsystems
        seen_docs = set()
        deduped = []
        for item in drift:
            new_docs = [d for d in item["expected_docs"] if d not in seen_docs]
            if new_docs:
                seen_docs.update(new_docs)
                item["expected_docs"] = new_docs
                deduped.append(item)
        drift = deduped

        # Auto-dismiss logic
        head = get_head_sha(repo_root)
        state = load_state(repo_root)
        times_shown = 0

        if drift and head:
            if state.get("head_sha") == head:
                times_shown = state.get("times_shown", 0)
                if times_shown >= DISMISS_MAX_SHOWS:
                    drift = []
                else:
                    times_shown += 1
                    save_state(repo_root, {"head_sha": head, "times_shown": times_shown})
            else:
                times_shown = 1
                save_state(repo_root, {"head_sha": head, "times_shown": 1})
        elif not drift and state:
            save_state(repo_root, {})

        output = format_output(drift, times_shown)
        if output:
            print(output)

    except Exception:
        pass  # Never block prompt submission


if __name__ == "__main__":
    main()
