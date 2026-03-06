#!/usr/bin/env python3
"""
Context Drift Check — detects when code changes happen without
corresponding context doc updates.

Parses the MCP server's SUBSYSTEMS dict, scans recent git commits,
and flags subsystems where code files changed but context docs didn't.

Usage:
    python3 .kiro/scripts/context-drift-check.py [--commits N] [--since DAYS]

Options:
    --commits N     Check last N commits (default: 20)
    --since DAYS    Check commits from last N days (default: 7)
    --verbose       Show all subsystems, not just drifted ones
"""

import argparse
import ast
import re
import subprocess
import sys
from pathlib import Path

# Priority tiers — HIGH gets auto-update warnings, MEDIUM gets mentions, LOW suppressed
PRIORITY_TIERS: dict[str, str] = {
    "core-infrastructure": "HIGH",
    "automations": "HIGH",
    "stores": "HIGH",
    "tasks": "MEDIUM",
    "projects": "MEDIUM",
    "sharing": "MEDIUM",
    "tms": "MEDIUM",
    "keyboard": "MEDIUM",
    "ui-shared": "LOW",
    "e2e-tests": "LOW",
}


def find_workspace_root() -> Path:
    """Walk up from this script to find the workspace root (contains package.json)."""
    current = Path(__file__).resolve().parent
    for _ in range(10):
        if (current / "package.json").exists():
            return current
        current = current.parent
    print("ERROR: Could not find workspace root (no package.json found)", file=sys.stderr)
    sys.exit(1)


def get_changed_files(workspace: Path, commits: int = 20, since_days: int = 7) -> set[str]:
    """Get files changed in recent git commits."""
    try:
        result = subprocess.run(
            ["git", "-P", "log", f"-n{commits}", f"--since={since_days} days ago",
             "--name-only", "--pretty=format:"],
            capture_output=True, text=True, cwd=workspace
        )
        if result.returncode != 0:
            print(f"WARNING: git log failed: {result.stderr.strip()}", file=sys.stderr)
            return set()
        files = set()
        for line in result.stdout.strip().splitlines():
            line = line.strip()
            if line:
                files.add(line)
        return files
    except FileNotFoundError:
        print("WARNING: git not found in PATH", file=sys.stderr)
        return set()


def parse_subsystems_from_mcp(workspace: Path) -> dict[str, dict]:
    """Parse SUBSYSTEMS dict from mcp-server/server.py using regex extraction."""
    server_path = workspace / "mcp-server" / "server.py"
    if not server_path.exists():
        print(f"WARNING: MCP server not found at {server_path}", file=sys.stderr)
        return {}

    content = server_path.read_text()

    # Extract the SUBSYSTEMS dict using regex to find the block
    match = re.search(
        r'^SUBSYSTEMS:\s*dict\[.*?\]\s*=\s*(\{.*?^\})',
        content, re.MULTILINE | re.DOTALL
    )
    if not match:
        print("WARNING: Could not parse SUBSYSTEMS from server.py", file=sys.stderr)
        return {}

    try:
        subsystems_str = match.group(1)
        # ast.literal_eval handles Python dict literals safely
        return ast.literal_eval(subsystems_str)
    except (ValueError, SyntaxError) as e:
        print(f"WARNING: Failed to parse SUBSYSTEMS dict: {e}", file=sys.stderr)
        return {}


def classify_file(filepath: str, subsystems: dict[str, dict]) -> list[str]:
    """Find which subsystems a file belongs to."""
    matches = []
    for key, sub in subsystems.items():
        sub_files = sub.get("files", [])
        for sf in sub_files:
            # Direct match or directory match
            if filepath == sf or filepath.startswith(sf.rstrip("/") + "/"):
                matches.append(key)
                break
        else:
            # Heuristic: match by directory prefix
            if key == "core-infrastructure" and filepath.startswith("lib/"):
                matches.append(key)
            elif key == "stores" and filepath.startswith("stores/"):
                matches.append(key)
            elif key == "e2e-tests" and filepath.startswith("e2e/"):
                matches.append(key)
            elif key == "ui-shared" and (filepath.startswith("components/") or filepath.startswith("app/")):
                matches.append(key)
            elif filepath.startswith(f"features/{key}/"):
                matches.append(key)
    return matches


def is_context_doc(filepath: str) -> bool:
    """Check if a file is a context doc or documentation file."""
    return (
        filepath.startswith(".kiro/context/")
        or filepath.endswith("README.md")
        or filepath.endswith("ARCHITECTURE.md")
        or filepath.endswith("DECISIONS.md")
        or filepath.endswith("EXTENDING.md")
        or filepath.endswith("DATA-FLOW.md")
        or filepath.startswith(".kiro/steering/")
    )


def check_drift(
    subsystems: dict[str, dict],
    changed_files: set[str],
    verbose: bool = False,
) -> list[dict]:
    """Check each subsystem for code changes without doc updates."""
    findings = []

    for key, sub in subsystems.items():
        priority = PRIORITY_TIERS.get(key, "MEDIUM")

        # Skip LOW priority unless verbose
        if priority == "LOW" and not verbose:
            continue

        code_changed = False
        docs_changed = False
        changed_code_files = []
        changed_doc_files = []

        for f in changed_files:
            subs = classify_file(f, subsystems)
            if key in subs:
                if is_context_doc(f):
                    docs_changed = True
                    changed_doc_files.append(f)
                elif f.endswith((".ts", ".tsx", ".js", ".jsx", ".css")):
                    code_changed = True
                    changed_code_files.append(f)

        if code_changed and not docs_changed:
            findings.append({
                "subsystem": key,
                "name": sub.get("name", key),
                "priority": priority,
                "code_files": changed_code_files,
                "context_doc": f".kiro/context/{key}.md",
            })

    return findings


def format_report(findings: list[dict], commits: int, since_days: int, total_changed: int) -> str:
    """Format the drift report for stdout."""
    lines = []
    lines.append("=" * 60)
    lines.append("  CONTEXT DRIFT CHECK")
    lines.append("=" * 60)
    lines.append(f"  Scanned: last {commits} commits / {since_days} days")
    lines.append(f"  Changed files: {total_changed}")
    lines.append(f"  Drifted subsystems: {len(findings)}")
    lines.append("=" * 60)

    if not findings:
        lines.append("")
        lines.append("  ✅ No drift detected — all code changes have matching doc updates.")
        lines.append("")
        return "\n".join(lines)

    # Sort by priority: HIGH first
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    findings.sort(key=lambda f: priority_order.get(f["priority"], 9))

    lines.append("")
    for f in findings:
        icon = "🔴" if f["priority"] == "HIGH" else "🟡" if f["priority"] == "MEDIUM" else "⚪"
        lines.append(f"  {icon} [{f['priority']}] {f['name']} ({f['subsystem']})")
        lines.append(f"     Context doc: {f['context_doc']}")
        lines.append(f"     Changed code ({len(f['code_files'])} files):")
        for cf in f["code_files"][:5]:
            lines.append(f"       - {cf}")
        if len(f["code_files"]) > 5:
            lines.append(f"       ... and {len(f['code_files']) - 5} more")
        lines.append("")

    lines.append("-" * 60)
    lines.append("  ACTION: Update the context docs listed above, or run the")
    lines.append("  drift-detection hook for a full 6-category audit.")
    lines.append("-" * 60)
    lines.append("")

    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="Check for context documentation drift")
    parser.add_argument("--commits", type=int, default=20, help="Number of recent commits to check")
    parser.add_argument("--since", type=int, default=7, help="Check commits from last N days")
    parser.add_argument("--verbose", action="store_true", help="Include LOW priority subsystems")
    args = parser.parse_args()

    workspace = find_workspace_root()
    subsystems = parse_subsystems_from_mcp(workspace)

    if not subsystems:
        print("ERROR: No subsystems found. Is mcp-server/server.py present?", file=sys.stderr)
        sys.exit(1)

    changed_files = get_changed_files(workspace, args.commits, args.since)

    if not changed_files:
        print("No changed files found in the specified commit range.")
        sys.exit(0)

    findings = check_drift(subsystems, changed_files, args.verbose)
    report = format_report(findings, args.commits, args.since, len(changed_files))
    print(report)

    # Exit code: 1 if HIGH priority drift found, 0 otherwise
    has_high = any(f["priority"] == "HIGH" for f in findings)
    sys.exit(1 if has_high else 0)


if __name__ == "__main__":
    main()
