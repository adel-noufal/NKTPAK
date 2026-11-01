"""
NxtPak AI — Ground Rules & Anti-Mock Grep Test.
Enforces Ground Rule 0: No hardcoded prompt example text, fake checks, mascots, or Hackathon strings.
"""

import os
import re
import pytest

FORBIDDEN_PATTERNS = [
    r"11 of 16 filled",
    r"9 from elarabygroup\.com",
    r"NXTPAK Hackathon",
    r"\bHackathon\b",
    r"El Araby Official Website ✓",
    r"Engineering Datasheet \(PDF\) ✓",
]

def get_codebase_files():
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    checked_extensions = (".py", ".tsx", ".ts", ".jsx", ".js", ".json", ".html")
    skip_dirs = {
        ".git", "node_modules", "dist", "build", ".pytest_cache",
        "venv", ".venv", "__pycache__", ".pnpm-store"
    }

    files_to_check = []
    for root, dirs, files in os.walk(base_dir):
        dirs[:] = [d for d in dirs if d not in skip_dirs]
        for f in files:
            if f.endswith(checked_extensions):
                # Skip this test file itself and package lock files
                if f in ("test_ground_rules_grep.py", "pnpm-lock.yaml", "package-lock.json"):
                    continue
                files_to_check.append(os.path.join(root, f))
    return files_to_check

def test_no_forbidden_prompt_strings():
    """Verify that none of the forbidden example strings or Hackathon words exist in source code."""
    files = get_codebase_files()
    assert len(files) > 10, "Should find codebase files to inspect"

    violations = []
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
                for pattern in FORBIDDEN_PATTERNS:
                    matches = re.findall(pattern, content, re.IGNORECASE)
                    if matches:
                        rel_path = os.path.relpath(filepath)
                        violations.append(f"{rel_path}: matched forbidden pattern '{pattern}' ({len(matches)} times)")
        except Exception:
            pass

    assert not violations, f"Forbidden hardcoded strings found in codebase:\n" + "\n".join(violations)
