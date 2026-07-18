# Production Architecture Direction

V1 stays local and file-based. The deployable dashboard stores data in browser local storage so Mark can use it immediately without persisting candidate data on a hosted backend. Production moves to a hosted SaaS architecture only after the local operating package and personal pilot workflow are validated.

## Data Layer

Use Neon Postgres for production storage.

Core table groups:

- tenants and users
- OAuth identities and sessions
- candidate profiles
- source materials and evidence labels
- job opportunities
- generated assets
- outreach drafts and send history
- compensation estimates
- dashboard status history
- internal aggregate metrics
- audit events
- billing customers and subscriptions

## Authentication

- The personal Vercel build may use an env-gated HTTP Basic Auth gate.
- Use managed email/password auth before storing customer information remotely.
- Keep tenant boundaries explicit in every customer-owned table.
- Store minimum personal data required for the workflow.
- Support account deletion and export before broad launch.

## Payments

- Use Stripe-hosted Checkout or Payment Links first.
- Enable Link through Stripe-hosted flows when available.
- Keep card data out of the app.
- Map billing status to tenant access through Stripe webhooks.

## Internal Metrics

Internal-only counters should show aggregate counts only:

- accounts created
- resumes upgraded
- cover letters generated
- applications prepared
- applications submitted
- outreach drafts created
- responses logged
- interviews logged
- jobs acquired

Do not show customer names in the counter view.

## Source Control and Distribution Controls

The production product should not ship source code to customers. Use:

- private repository access
- hosted SaaS delivery
- license terms forbidding redistribution
- build provenance and package integrity checks
- watermarking or tenant identifiers in exported materials where appropriate
- audit logs for admin access and deployment events

Do not implement covert surveillance on customer machines. Tracking should be limited to lawful product telemetry, audit logs, access controls, and contract enforcement.

## Rollout Gates

1. Local package validated.
2. Pilot workflows measured.
3. Data model reviewed.
4. Authentication and billing threat model reviewed.
5. Tenant isolation tested.
6. Support process documented.
