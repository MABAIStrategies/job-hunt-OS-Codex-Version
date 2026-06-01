# Intake Engine

Classify every request before generating assets.

## Input Types

- URL: retrieve the live page when browsing is available, identify whether it is direct company, ATS, job board, or aggregator, and extract the apply route.
- Screenshot: extract visible title, company, location, work mode, posted date, apply affordances, and keywords. Supplement with current research when visible data is incomplete.
- Pasted job description: parse the text directly and preserve exact job language for keyword matching.
- Title only: build a low-confidence composite role profile and ask for company or industry if that changes the package materially.

## Required Job Fields

- job title
- company
- industry or business model
- location and work mode
- seniority and years required
- responsibilities
- required skills
- preferred skills
- culture signals
- ATS keywords
- application method
- apply URL when available
- requisition number when available
- known recruiter or hiring manager when available

## Confidence Rules

- Label title-only and screenshot-only packages as lower confidence until a current posting or company context is found.
- Ask only for missing information that blocks a truthful package.
- Keep aggregators separate from direct apply routes.
