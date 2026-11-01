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

## Single-User Auth Gate

The deployed app requires browser HTTP Basic Auth. Set both values in Vercel environment variables (Production, and Preview if previews should be reachable):

```bash
JOB_HUNT_AUTH_EMAIL=
JOB_HUNT_AUTH_PASSWORD=
```

Do not commit actual values. The current production deployment has this gate enabled through encrypted Vercel environment variables.

How `proxy.ts` behaves:

- **Production fails closed.** When `NODE_ENV` is `production` (every `next build` / `next start` and every Vercel deployment, Preview included) and either variable is missing or empty, every matched request gets `503 Service unavailable: authentication is not configured.` The app is never served unauthenticated because of a missing or partial config. Set both variables and redeploy to restore access.
- **Local development stays open.** Under `npm run dev` with neither variable set, the gate is skipped so you can work locally. Set both in `.env.local` to test the login prompt.
- **Constant-time comparison.** Submitted credentials are checked with a constant-time comparison: both sides are hashed to SHA-256 with Web Crypto and compared byte by byte without exiting early. Email and password are always both checked, so response timing doesn't show which field was wrong or how much of it matched.
- Auth responses send `Cache-Control: no-store`.

This gate is appropriate for the personal v1 only. Before customer or multi-user launch, replace it with Clerk, Neon Auth, Auth.js, or another managed account system with proper session handling, account recovery, auditability, and tenant isolation.

## Future Integrations

Reserved environment hooks:

```bash
DATABASE_URL=
STRIPE_SECRET_KEY=
STRIPE_PAYMENT_LINK_URL=
NEXT_PUBLIC_STRIPE_PAYMENT_LINK_URL=
```

Neon Postgres remains the preferred production database because Codex has a Neon connector available. Stripe-hosted Payment Links or Checkout remain the preferred first billing path to keep card data outside the app.
