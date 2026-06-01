# Runtime Adapters

This package is platform-agnostic. Use only adapters that are actually available in the current runtime.

## Recommended Adapters

- Web research adapter for current-day verification.
- PDF or document renderer for resume and cover letter outputs.
- Spreadsheet or database adapter for dashboard logging.
- Email or messaging adapter for follow-up drafts and sends.
- Calendar or automation adapter for reminders.
- Figma or Canva adapter for optional branded launch and application visuals.
- GitHub adapter for pulling approved project evidence from repositories.
- Future Neon Postgres adapter for production storage.
- Future OAuth adapter for customer login.
- Future Stripe-hosted payment adapter for billing.

## Safety Defaults

- Draft communications are safe to prepare.
- Sending messages, submitting applications, uploading personal files, or charging payment requires explicit user authorization at action time.
- Production customer data must be stored in authenticated, access-controlled systems.
