# Job Hunt OS Roadmap

## Stage 1: Codex-Native Operating Package

Goal: Create a platform-agnostic local repo that future agents can use immediately.

Deliverables:

- Codex-native `job-hunt-os` skill package
- schemas, examples, references, and templates
- canonical master spec
- launch announcement assets
- sales sequences
- internal pricing matrix
- production architecture direction

Exit criteria:

- Skill validator passes.
- Schema and artifact tests pass.
- No legacy runtime paths or tool names leak into the migrated skill.

## Stage 2: Local Workflow Runner

Goal: Make the local package executable for repeatable application runs.

Deliverables:

- CLI command for `new-opportunity`
- local file database for profiles, jobs, assets, and outreach records
- deterministic PDF generation pipeline
- local dashboard export to CSV or spreadsheet
- fixture-based evaluation set

Exit criteria:

- One sample job input creates a complete local package and dashboard row.
- Truth-preservation checks block unsafe edits.
- Current research fields are explicitly marked verified or unverified.

## Stage 3: Team Pilot

Goal: Package Job Hunt OS for controlled pilot use by staffing-stack buyers.

Deliverables:

- admin-ready onboarding docs
- role templates for staffing, RPO, outplacement, and career services
- pilot reporting dashboard
- usage counters
- feedback capture workflow

Exit criteria:

- Pilot operator can process opportunities without developer help.
- Weekly metrics show resumes upgraded, applications prepared, applications submitted, responses, interviews, and placements.

## Stage 4: Hosted SaaS Foundation

Goal: Move from local storage to secure hosted product infrastructure.

Deliverables:

- Neon Postgres schema and migrations
- OAuth login
- Stripe-hosted checkout and Link support
- customer profile isolation
- event audit logs
- internal aggregate metrics dashboard
- private repository and deployment controls

Exit criteria:

- Customer data is authenticated and tenant-isolated.
- Billing is handled through hosted Stripe flows.
- Internal counters expose aggregates only.

## Stage 5: Production Launch

Goal: Sell Job Hunt OS as an MAB AI Strategies product.

Deliverables:

- production landing page
- enterprise security and privacy docs
- sales enablement deck
- customer onboarding playbooks
- support and escalation process
- post-launch measurement plan

Exit criteria:

- Paying pilot customers can onboard.
- Product usage and outcomes are measured.
- Source distribution is controlled through hosted access and legal terms.
