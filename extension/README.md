# Job Hunt OS — Chrome Extension

Tailor a truthful, ATS-optimized resume and cover letter to any job page in one click, find the jobs you're most likely to land, and track every application and follow-up in Google Sheets.

It's built on the `job-hunt-os` and `resume-optimizer` skills: same truth policy, same ATS gap analysis, same follow-up cadence. Everything runs inside a Chrome side panel.

## What it does

| | Feature | How |
|---|---|---|
| 1 | **Tailor from any job page** | Click the toolbar icon → **Capture job**. Reads schema.org `JobPosting` data or site-specific selectors for LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, Glassdoor, and ZipRecruiter, with a generic fallback. You can also highlight a JD and right-click, or press `Alt+Shift+J`. |
| | **Preview → drag & drop** | Generates a resume PDF, a cover letter PDF and a plain-text ATS version. Drag a file chip onto the application's upload box or your desktop, or click **Attach to page** to fill the form's `<input type=file>` automatically. |
| | **Share URL + tracking** | **Save to Drive + Sheet** uploads the PDFs to Drive, returns view links you can paste into any application, and adds a row to the Tracker tab (61-column Job Hunter Pro v3 schema). |
| 2 | **Find jobs you can land** | On any search results page, **Scan** pulls every listing, pre-ranks them locally, and has Claude score fit features (must-have coverage, title adjacency, domain, seniority, location). A fixed logistic formula turns those into an interview likelihood. Badges are painted onto the page. |
| | **Tiered confidence** | Scout shows the 30–49% band, Pro unlocks 50–74%, Elite unlocks 75%+. Higher bands appear as locked teasers, which is the upgrade hook. Higher tiers also deep-read the full posting, so their estimates are more reliable. |
| 3 | **Truth Lock** | Employers, titles, dates, chronology, education and certifications always come from your master resume, never from the model. Any number the model writes that isn't in your resume gets flagged before you send. |
| | **Follow-up engine** | **I applied** starts the cadence: recruiter today → hiring manager +1 day → peer +3 days, with drafts ready to copy. Chrome notifications fire for anything due, and the Apps Script emails a daily digest. Nothing is ever sent for you. |
| | **Intel** | Before/after ATS score, keyword gaps (critical/high/nice), red flags, a comp estimate (live web research on Pro+), a LinkedIn headline, interview questions, and a "what changed and why" log. |
| | **Restyle** | Copies the tailored content and opens Canva or Adobe Express resume templates. |

**Resume first, always:** every tab except Settings stays locked until a resume is on file.

## Install (developer mode)

1. `chrome://extensions` → enable **Developer mode** → **Load unpacked** → select the **`extension`** folder inside the repo (the one that contains `manifest.json`), not the repo root. Picking the root gives "Manifest file is missing or unreadable."
2. Pin **Job Hunt OS** from the puzzle-piece menu and click it to open the side panel.
3. Choose an AI provider, paste its API key, and upload your resume (PDF or TXT). A headshot is optional; by default it's only used for direct or referral applications, since ATS portals strip photos.

### AI providers

Pick one in **Settings → AI provider**. Keys are saved per provider, so you can switch at any time. **Test key + load models** checks the key and lists the model IDs it can use.

| Provider | Reads PDF resumes | Live web research | Default writing / scan models |
|---|---|---|---|
| Anthropic (Claude) | ✓ | ✓ | claude-sonnet-5-5 / claude-haiku-5-5 |
| Google AI Studio (Gemini) | ✓ | ✓ (Google Search) | gemini-2.5-pro / gemini-2.5-flash |
| OpenAI | ✓ | – | gpt-5 / gpt-5-mini |
| xAI (Grok) | text only | – | grok-4 / grok-3-mini |
| OpenRouter | ✓ | ✓ (web plugin) | anthropic/claude-sonnet-4.5 / google/gemini-2.5-flash |
| Groq | text only | – | openai/gpt-oss-120b / llama-3.1-8b-instant |
| NVIDIA NIM | text only | – | meta/llama-3.3-70b-instruct / meta/llama-3.1-8b-instruct |

You can edit the model IDs. If the active provider can't read PDFs and you've saved a key for one that can, the one-time resume parsing uses that one automatically. Otherwise, paste your resume text.

**Subscriptions vs. API keys:** ChatGPT Plus/Pro, Gemini Advanced / Google AI Pro, and SuperGrok are chat-app subscriptions. None of them include API access, and none of these providers lets a third-party app sign in with them. Each provider needs an API key from its developer console, billed separately (Google AI Studio and Groq have free tiers; NVIDIA NIM gives trial credits).

### Connect the Google Sheet (optional, recommended)

1. Open your tracker sheet → **Extensions → Apps Script** → paste `apps-script/Code.gs`.
2. Run `setupWorkbook` once. It creates or repairs the tabs, a Drive folder, a token, and the daily digest trigger.
3. **Deploy → New deployment → Web app**, execute as *Me*, access *Anyone*.
4. In the extension, go to **Settings → Google Sheet tracker** and paste the web app URL and token (sheet menu **Job Hunt OS → Show extension token**), then click **Test connection**.

## Architecture

```
extension/
  manifest.json        MV3; side panel, optional host permissions requested per site
  background.js        side panel, context menus, Alt+Shift+J, daily follow-up alarm
  sidepanel.*          UI: onboarding gate, Tailor, Find Jobs, Pipeline, Settings
  lib/ai.js            7 providers (Claude, Gemini, OpenAI, Grok, OpenRouter, Groq, NIM); BYOK
  lib/prompts.js       profile, tailor and scan prompts (skill rules distilled)
  lib/extract.js       functions injected into pages: JD capture, card scan, badges, file attach
  lib/scoring.js       interview-likelihood model + local prefilter + page signals
  lib/plans.js         Scout / Pro / Elite limits and confidence bands
  lib/truth.js         Truth Lock (locked fields + unverified-metric flags)
  lib/pdf.js           dependency-free PDF writer (real text, ATS-parseable, JPEG headshot)
  lib/render.js        resume / cover letter layouts, plain-text ATS export
  lib/sheets.js        Apps Script client + Tracker row mapping
  apps-script/Code.gs  Drive storage, share links, Tracker upsert, scan log, daily digest
  tools/               smoke test, UI harness, icon generator
```

There's no build step and no third-party runtime code.

## Develop & test

```bash
node tools/smoke-test.mjs
```

This checks scoring, the Truth Lock and PDF output, and writes samples to `tools/out/`. To test the UI without Chrome, serve this folder (`python -m http.server 8765`) and open `/tools/ui-harness.html`. It runs the real side panel against a stubbed `chrome.*` API and a canned Claude response.

## Privacy

Your resume, profile and applications are stored in `chrome.storage.local`. The resume and job text go to your chosen AI provider only when you build a profile, tailor, or scan. Files go to your own Google Drive only when you click **Save to Drive + Sheet**. Drive links are set to *anyone with the link can view* so recruiters can open them.

See [docs/ROADMAP.md](docs/ROADMAP.md) and [docs/PRICING.md](docs/PRICING.md).
