# Deployment

Job Hunt OS v1 deploys as a Next.js app on Vercel. Opportunities use browser local storage and the larger contact inventory uses browser IndexedDB. This keeps the first serviceable iteration usable for Mark's personal job search without persisting candidate or customer data on a shared backend.

## Contact Import

Open the `Contacts` workspace and import a CSV or TSV file. The browser recognizes common headings for names, email, phone, company, title, LinkedIn URL, location, tags, and notes. Reimports are deduplicated by email, LinkedIn URL, then name plus company.

Use `examples/contacts-import-template.csv` as the canonical heading template. Contact data remains on the device and browser where it was imported until authenticated database persistence is implemented.

## Local Run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Vercel

Vercel auto-detects Next.js. This repo also includes `vercel.json` so install and build commands are explicit.

```bash
vercel
vercel --prod
```

Use the generated `*.vercel.app` URL unless MAB AI Strategies later chooses a custom domain.

## Optional Single-User Auth Gate

The deployed app can require browser HTTP Basic Auth when both values are set in Vercel environment variables:

```bash
JOB_HUNT_AUTH_EMAIL=
JOB_HUNT_AUTH_PASSWORD=
```

Do not commit actual values. The current production deployment has this gate enabled through encrypted Vercel environment variables. This gate is appropriate for the personal v1 only. Before customer or multi-user launch, replace it with Clerk, Neon Auth, Auth.js, or another managed account system with proper session handling, account recovery, auditability, and tenant isolation.

## Future Integrations

Reserved environment hooks:

```bash
DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_PAYMENT_LINK_URL=
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL=
```

Neon Postgres remains the preferred production database because Codex has a Neon connector available. Stripe-hosted Payment Links or Checkout remain the preferred first billing path to keep card data outside the app.
