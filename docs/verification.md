# Verification

## Local Checks

```bash
python3 -m pip install -r requirements-dev.txt
npm install
python3 -m pytest tests/test_repository_artifacts.py -q
python3 /Users/mark/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  "/Users/mark/Documents/Job Hunt OS: Codex Version/skills/job-hunt-os"
npm audit --audit-level=moderate
npm run build
for f in skills/job-hunt-os/schemas/*.json examples/*.json launch/export-manifest.json; do
  python3 -m json.tool "$f" >/dev/null || exit 1
done
pattern='/home/'"claude"'|/mnt/'"skills"'|/mnt/'"user-data"'|web_'"search"'|web_'"fetch"'|present_'"files"'|Claude '"will"
rg -n "$pattern" .
```

Expected:

- tests pass
- skill validator reports `Skill is valid!`
- npm audit reports zero vulnerabilities at moderate or higher
- Next.js production build succeeds
- JSON parse loop exits 0
- hygiene search returns no matches

## GitHub Actions

The workflow in `.github/workflows/validate.yml` runs the same core checks without relying on local machine state.

## Visual Checks

Use a browser or Playwright to inspect:

- desktop at approximately `1440 x 1100`
- mobile at approximately `390 x 1200`

Expected:

- dashboard renders on first screen
- no primary blank canvas
- no overlapping target profile, metric, form, table, or detail-panel text
- add-opportunity controls stay visible
