# Roadmap

## Shipped in v0.1
- Resume-first onboarding gate, master profile with Truth Lock
- One-click JD capture (8 boards plus a generic fallback), selection and context-menu capture, keyboard shortcut
- Tailored resume PDF, cover letter PDF and ATS text; drag-and-drop and auto-attach to upload fields
- ATS before/after score, keyword gaps, red flags, comp estimate, interview questions, change log
- Board scan with interview-likelihood scoring, on-page badges, Scout/Pro/Elite confidence bands
- Google Sheet sync via Apps Script: Drive share links, Tracker upsert, scan log, daily digest email
- Follow-up cadence (recruiter → hiring manager → peer) with drafts and Chrome notifications

## Differentiators vs. generic tools
Most of these were suggestions for "make it better than market alternatives."
- **Truth Lock**: locked chronology plus flags on unverified metrics. Most AI resume tools happily invent numbers.
- **Explainable odds**: a fixed formula over visible features, competition and staleness signals, not a vibe score.
- **Route intelligence**: detects the ATS and Easy Apply, decides headshot and design accordingly, and prefers direct apply.
- **Ghost-job / stale-post detection**: discounts listings older than 30 days or with high applicant counts.
- **Your data, your sheet**: no vendor lock-in. The tracker is a Google Sheet you own.

## Next
1. **Email triage**: a Gmail add-on or API watch that classifies recruiter replies, updates `response_received`, and drafts responses.
2. **Hiring-manager discovery before the interview**: find the recruiter, hiring manager and peers (Apollo, Hunter, LinkedIn), then fill Contacts and Outreach Queue. Sending still needs the user's approval.
3. **Custom triggers**: user rules like "scan these 3 saved searches every morning" or "tailor automatically when a 75%+ job appears" (chrome.alarms + background tabs).
4. **Expandable sources**: a selector registry so users or the community can add boards without a release (JSON site adapters synced from the repo).
5. **Auto-apply and monitoring**: supervised autofill of ATS forms (Greenhouse, Lever, Ashby first), plus application status checks. Always confirm before submit.
6. Mock hiring-manager review and knowledge-gap plan in the side panel (Elite).
7. Outcome-based recalibration of the likelihood weights from Tracker data.
8. Hosted proxy and Stripe billing (see PRICING.md), then Chrome Web Store listing.
