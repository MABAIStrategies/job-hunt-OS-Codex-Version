# Security Policy

## Repository Visibility

This repository should remain private while Job Hunt OS is in product development. Do not make the repository public without explicit MAB AI Strategies approval.

## Do Not Commit

- customer information
- candidate resumes or profiles
- generated application packages containing personal data
- credentials, tokens, OAuth secrets, webhook secrets, or API keys
- payment or billing data
- raw browser/session artifacts
- private customer contracts or pricing exceptions

## Production Security Direction

The hosted product should use:

- OAuth before storing customer information remotely
- tenant-isolated Neon Postgres data
- Stripe-hosted billing flows
- least-privilege admin access
- aggregate-only internal counters
- audit logs for sensitive admin and product events

## Reporting

Report security concerns directly to MAB AI Strategies ownership. Do not create public issues for vulnerabilities or customer-data concerns.
