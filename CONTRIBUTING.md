# Contributing

This is a proprietary MAB AI Strategies repository. Contributions are limited to approved collaborators.

## Development Rules

- Keep the Codex skill package platform-native and concise.
- Keep detailed behavior in `references/`, `schemas/`, and `templates/`.
- Preserve truth and evidence constraints in all resume and application workflows.
- Do not add customer data, resumes, generated personal packages, credentials, or billing records.
- Run validation before opening a pull request or merging.

## Required Checks

```bash
python3 -m pytest tests/test_repository_artifacts.py -q
python3 /Users/mark/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  "/Users/mark/Documents/Job Hunt OS: Codex Version/skills/job-hunt-os"
```
