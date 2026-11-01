#!/usr/bin/env python3
"""Repo-local validator for a Codex skill package.

Replaces the machine-specific path to Codex's skill-creator quick_validate.py so
`npm run validate` works in CI and on any machine. Checks the same essentials:
SKILL.md exists, has YAML frontmatter, a hyphen-case `name` that matches the
folder, a usable `description`, only known frontmatter keys, and stays under
500 lines. Also checks that agents/*.yaml files parse.

Usage: python3 scripts/validate_skill.py skills/job-hunt-os
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML is required: python3 -m pip install -r requirements-dev.txt")

ALLOWED_KEYS = {"name", "description", "license", "allowed-tools", "metadata"}
NAME_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
MAX_NAME = 64
MAX_DESCRIPTION = 1024
MAX_LINES = 500


def validate(skill_dir: Path) -> list[str]:
    errors: list[str] = []
    skill_md = skill_dir / "SKILL.md"
    if not skill_md.is_file():
        return [f"{skill_md} not found"]

    content = skill_md.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return ["SKILL.md is missing YAML frontmatter"]

    try:
        data = yaml.safe_load(match.group(1)) or {}
    except yaml.YAMLError as exc:
        return [f"Invalid YAML frontmatter: {exc}"]
    if not isinstance(data, dict):
        return ["Frontmatter must be a YAML mapping"]

    unknown = set(data) - ALLOWED_KEYS
    if unknown:
        errors.append(f"Unexpected frontmatter keys: {', '.join(sorted(unknown))}")

    name = data.get("name")
    if not isinstance(name, str) or not name.strip():
        errors.append("Missing 'name' in frontmatter")
    else:
        if not NAME_RE.match(name):
            errors.append(f"Name '{name}' must be hyphen-case (lowercase letters, digits, hyphens)")
        if len(name) > MAX_NAME:
            errors.append(f"Name is longer than {MAX_NAME} characters")
        if name != skill_dir.resolve().name:
            errors.append(f"Name '{name}' does not match folder '{skill_dir.resolve().name}'")

    description = data.get("description")
    if not isinstance(description, str) or not description.strip():
        errors.append("Missing 'description' in frontmatter")
    else:
        if "<" in description or ">" in description:
            errors.append("Description cannot contain angle brackets")
        if len(description) > MAX_DESCRIPTION:
            errors.append(f"Description is longer than {MAX_DESCRIPTION} characters")

    if len(content.splitlines()) >= MAX_LINES:
        errors.append(f"SKILL.md must stay under {MAX_LINES} lines")

    for agent_file in sorted((skill_dir / "agents").glob("*.y*ml")):
        try:
            yaml.safe_load(agent_file.read_text(encoding="utf-8"))
        except yaml.YAMLError as exc:
            errors.append(f"{agent_file.relative_to(skill_dir)} is not valid YAML: {exc}")

    return errors


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        print("Usage: python3 scripts/validate_skill.py <skill-directory>", file=sys.stderr)
        return 2
    errors = validate(Path(argv[1]))
    if errors:
        for err in errors:
            print(f"ERROR: {err}", file=sys.stderr)
        return 1
    print("Skill is valid!")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
