# Job Hunt OS Codex Version

Job Hunt OS is a Codex-native operating package and deployable personal dashboard for turning a job opportunity into a complete, truthful, role-specific application workflow.

It accepts a job URL, screenshot, pasted job description, or target title and produces the operating artifacts needed for a disciplined job hunt:

- current compensation estimate
- truthful tailored resume and cover letter package
- ATS gap analysis
- application route detection
- recruiter, hiring-manager, and peer follow-up plan
- interview prep
- mock hiring-manager review
- knowledge-gap plan
- dashboard-ready tracking record

## Status

This repository now includes two pieces:

- a Codex-native `job-hunt-os` skill package
- a first serviceable Next.js dashboard for Mark's personal job search

The web app is deployable to Vercel and stores opportunity data in browser local storage for v1. Hosted SaaS capabilities such as Neon Postgres, managed email/password auth, Stripe-hosted billing, internal counters, and tenant audit logs are documented in the roadmap and production architecture notes, but are not enabled for customer data yet.

## Repository Map

| Path | Purpose |
|---|---|
| `skills/job-hunt-os/` | Codex-native skill package |
| `skills/job-hunt-os/references/` | Engine-level operating references |
| `skills/job-hunt-os/schemas/` | JSON Schema contracts |
| `skills/job-hunt-os/templates/` | Reusable output templates |
| `examples/` | Example payloads for each schema |
| `product/master-spec.md` | Platform-agnostic canonical product spec |
| `strategy/` | Roadmap, ICP sales sequences, pricing, production architecture |
| `launch/` | Release copy, banner brief, video script, roadmap diagram, export manifest |
| `app/` | Next.js personal dashboard |
| `proxy.ts` | Optional env-gated single-user auth gate for Vercel |
| `tests/` | Repository artifact and migration hygiene tests |
| `docs/deployment.md` | Vercel deployment and env variable notes |
| `docs/go-live-checklist.md` | Pre-production checklist |

## Visual Assets

- Editable roadmap: https://www.figma.com/board/ZfiknyHOoM1UVewItluCrs?utm_source=chatgpt&utm_content=edit_in_figjam&oai_id=&request_id=0df16b61-03d6-4063-ad68-578b21c398e5
- Editable launch banner: https://www.figma.com/design/ZjauCFEtXetsVeZ99xO8PL

## Validation

Install dependencies:

```bash
python3 -m pip install -r requirements-dev.txt
npm install
```

Run repository and web checks:

```bash
python3 -m pytest tests/test_repository_artifacts.py -q
npm audit --audit-level=moderate
npm run build
```

Validate the Codex skill package:

```bash
python3 /Users/mark/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  "/Users/mark/Documents/Job Hunt OS: Codex Version/skills/job-hunt-os"
```

Run migration hygiene search:

```bash
pattern='/home/'"claude"'|/mnt/'"skills"'|/mnt/'"user-data"'|web_'"search"'|web_'"fetch"'|present_'"files"'|Claude '"will"
rg -n "$pattern" .
```

Expected result: no matches.

## Security and Distribution

This repository contains proprietary MAB AI Strategies product work. It should remain private unless MAB AI Strategies explicitly approves public release. Customer data, candidate profiles, source resumes, generated job packages, credentials, OAuth secrets, and billing details must not be committed to this repository.

See `SECURITY.md` and `LICENSE` before sharing or deploying.
