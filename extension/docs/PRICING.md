# Pricing & confidence tiers

The repo's `pricing-matrix.csv` covers B2B seats (Pilot/Team/Growth/Enterprise for staffing, RPO, and career services). The extension adds a consumer ladder built on interview-likelihood bands:

| Plan | $/mo | Matches unlocked | Packages/mo | Scans/day | Deep-read (full JD) per scan | Live comp + company research | Interview prep |
|---|---|---|---|---|---|---|---|
| Scout | 0 | 30–49% | 5 | 3 | 0 | – | preview |
| Pro | 19 | 30–74% | 60 | 25 | 10 | ✓ | ✓ |
| Elite | 49 | all, incl. 75%+ | 400 | 200 | 40 | ✓ | ✓ |

Jobs above your unlocked band still appear, blurred, with a count. For example: "3 jobs in this band unlock on Elite."

## How the likelihood is computed

Claude scores features only. `lib/scoring.js` turns them into a probability:

```
z = -4.2 + 3.0·coverage + 1.8·title + 1.2·domain − 0.9·|seniority_gap| + 0.8·location − 0.6·competition − 0.5·stale
p = min(0.92, sigmoid(z))
```

`competition` comes from visible applicant counts and Easy Apply. `stale` is set when a posting is more than 30 days old. The 0.92 cap stops the tool from promising certainty. The weights are a starting prior; recalibrate them with real outcomes logged in the Tracker (`response_received`, `interview_stage`) once there's data.

## Before charging money

BYOK mode enforces plan limits client-side, and anyone can edit them. Before you charge:

1. Put `lib/ai.js` calls behind a proxy (Cloudflare Worker, Vercel, or Supabase edge function) that holds the Anthropic key and checks a license.
2. Handle payments with Stripe Checkout and a customer portal. A webhook issues a license, and `plans.verifyLicense()` reads it.
3. Meter packages and scans server-side.
