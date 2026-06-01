---
name: job-hunt-os
description: End-to-end job hunt operating system for current job research, compensation estimation, truthful role-specific resume and cover letter generation, ATS gap analysis, follow-up sequencing, interview prep, mock hiring-manager review, knowledge-gap planning, and dashboard tracking. Use when a user provides a job URL, screenshot, pasted job description, target role, application workflow request, resume tailoring request, cover letter request, keyword gap request, or job-search tracking request.
---

# Job Hunt OS

## Purpose

Use this skill to turn a job opportunity into a complete, current, truthful application package and tracking record. It accepts a job URL, screenshot, pasted job description, or title-only target and produces compensation guidance, resume and cover letter outputs, follow-up drafts, interview prep, mock review, knowledge gaps, and dashboard-ready data.

## Operating Defaults

- Treat current facts as stale until checked when the output depends on job availability, compensation, company priorities, leadership, remote status, ATS route, or application URL.
- Produce resume and cover letter PDFs by default unless the user asks for another format.
- Preserve employer names, titles actually held, exact date ranges, chronology, and education history unless the user explicitly corrects them.
- Optimize summaries, bullet phrasing, section order, keyword alignment, and business framing only when grounded in source material.
- Do not invent employers, titles, dates, certifications, awards, revenue numbers, tools, or implementation claims.
- Draft outreach automatically, but do not send messages, submit applications, or transmit personal data without explicit user authorization.
- Keep user-facing outputs clean; keep internal reasoning clear about whether claims are verified, derived, inferred, or need confirmation.

## Workflow

1. **Intake**
   - Classify the input as URL, screenshot, pasted description, or title only.
   - Read `references/intake.md` for extraction rules and confidence handling.
   - If the input is too thin for a safe package, ask the minimum missing question.

2. **Current research**
   - Read `references/freshness-research.md`.
   - Verify the live posting, direct apply route, compensation signals, company priorities, work mode, and ATS classification when relevant.
   - Prefer direct company application routes over aggregators when available.

3. **Truth and evidence gate**
   - Read `references/truth-policy.md`.
   - Lock immutable fields before rewriting content.
   - Downgrade unsupported claims instead of making them sharper.

4. **Compensation**
   - Read `references/compensation.md`.
   - Return the 12-part compensation structure in the required order.
   - Use narrow ranges where evidence supports them and label uncertainty.

5. **ATS gap analysis**
   - Read `references/ats-gap-analysis.md`.
   - Compare the source profile against required and preferred job language.
   - Show current match, projected match, missing keywords, and red flags before final document delivery.

6. **Resume and cover letter**
   - Read `references/resume-cover-letter.md`.
   - Generate a truthful, role-specific resume and concise company-specific cover letter.
   - Prefer a branded executive PDF plus a clean ATS-safe version when useful.

7. **Follow-up**
   - Read `references/follow-up.md`.
   - Draft recruiter, hiring-manager, and peer outreach with dates based on the user's timezone.
   - Pause the sequence when a response arrives.

8. **Interview prep, mock review, and gaps**
   - Read `references/interview-prep.md`, `references/mock-review.md`, and `references/knowledge-gaps.md`.
   - Produce answer angles and study plans rooted in the user's actual record.

9. **Dashboard handoff**
   - Read `references/dashboard.md`.
   - Emit a `DashboardRecord` that conforms to `schemas/dashboard-record.schema.json`.
   - Use `templates/dashboard-row-template.csv` when a flat tracker row is needed.

## Bundled Resources

- `schemas/` contains JSON Schema contracts for the profile, job target, compensation, application package, dashboard record, outreach sequence, pricing matrix, and launch assets.
- `templates/` contains reusable output templates for application packages, dashboard rows, outreach drafts, release announcements, and pricing.
- `references/runtime-adapters.md` maps this skill to Codex, web research, file generation, Google Workspace, Figma, GitHub, future database, auth, and billing adapters.

## Output Contract

Unless the user narrows scope, return:

1. Compensation estimate
2. Resume PDF plan or generated file path
3. Cover letter PDF plan or generated file path
4. Direct application path
5. Follow-up plan
6. Interview prep pack
7. Mock hiring-manager review
8. Knowledge-gap guide
9. Dashboard row payload

Before final delivery, verify:

- Dates, employers, titles, and education are preserved.
- Claims are grounded.
- Current facts were checked where needed.
- Resume and cover letter are PDF-ready.
- The dashboard payload matches the schema.
