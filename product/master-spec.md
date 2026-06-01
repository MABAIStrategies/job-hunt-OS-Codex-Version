# Job Hunt OS - Platform-Agnostic Master Spec

Version: 1.0  
Status: Canonical v1 source  
Owner: MAB AI Strategies  
Primary user profile: Mark Bockrath  
Default timezone: America/New_York  
Default location: Philadelphia, Pennsylvania, United States

## Purpose

Job Hunt OS is an end-to-end application engine and tracking system. It turns a job URL, screenshot, pasted job description, or target title into a current compensation estimate, optimized application package, follow-up sequence, interview preparation pack, mock hiring-manager review, knowledge-gap plan, and dashboard tracking record.

It is not only a resume tool. It is a job-search operating system for the full lifecycle from opportunity discovery through follow-up and interview preparation.

## Goals

- Estimate annual compensation with current-day information.
- Generate truthful role-specific resume PDFs.
- Generate truthful role-specific cover letter PDFs.
- Preserve chronology, tenure, employer history, titles, and education.
- Optimize wording, positioning, sequencing, and relevance without fabrication.
- Detect the best available application route.
- Generate recruiter, hiring-manager, and peer follow-up drafts.
- Produce interview prep and mock hiring-manager review.
- Identify knowledge gaps and recommend the fastest credible path to close them.
- Track applications and correspondence in a central dashboard.

## Non-Goals

- Do not invent employers, titles, dates, credentials, awards, revenue numbers, or responsibilities.
- Do not materially exaggerate scope beyond user-approved source materials.
- Do not output stale compensation, stale application links, or stale company-context analysis when current data can be checked.
- Do not deliver DOCX by default.
- Do not send outreach, submit applications, upload personal data, or charge payment without explicit authorization.

## Core Architecture

Job Hunt OS has two agent layers and one shared data layer.

### Agent A: Application Engine

Handles each job opportunity.

Inputs:

- job URL
- screenshot
- pasted job description
- title-only target

Outputs:

- compensation estimate
- optimized resume PDF
- optimized cover letter PDF
- ATS-safe plain text resume when useful
- application path detection
- follow-up plan
- interview prep pack
- mock hiring-manager review
- knowledge-gap study guide

### Agent B: Dashboard Agent

Handles tracking, sequencing, and monitoring.

Responsibilities:

- log one record per opportunity
- record status changes
- record outreach history
- calculate next actions
- flag stale opportunities
- summarize pipeline health
- support weekly review and prioritization

### Shared Data Layer

Stores:

- master user profile
- source-of-truth resume data
- accomplishment repository
- approved awards and proof assets
- job records
- outreach records
- generated asset records
- knowledge-gap findings
- review history

## Source-of-Truth Hierarchy

When evidence conflicts, use this order:

1. User-approved master resume
2. Uploaded resume variants
3. User-provided accomplishments, projects, awards, and documented build work
4. Prior approved application materials
5. Current public research
6. Cautious inference consistent with items 1 through 5

Unsupported claims must not be stated as fact.

## Standing Defaults

- Resume output: PDF.
- Cover letter output: PDF.
- Tone: concise, practical, commercially fluent, AI-forward, credible, high-conviction.
- Current facts must be verified when they may have changed.
- Application routing prefers direct company apply paths when available.

## Required Engines

- Intake engine
- Current research engine
- Compensation engine
- ATS gap analysis engine
- Resume engine
- Cover letter engine
- Follow-up engine
- Interview prep engine
- Mock hiring-manager engine
- Knowledge-gap engine
- Dashboard agent

## Acceptance Tests

A build is acceptable only if a single job input can produce:

1. Company and role identification
2. Current compensation estimate
3. Truthful tailored resume PDF plan or generated file
4. Truthful tailored cover letter PDF plan or generated file
5. Best known application route
6. Recruiter, hiring-manager, and peer follow-up plan
7. Interview prep
8. Mock hiring-manager review
9. Knowledge-gap guide
10. Dashboard record

## Product Direction

The v1 repository is local and file-based. The deployable product evolves into a hosted platform with authenticated customers, secure profile storage, billing, internal metrics, and auditable use controls.
