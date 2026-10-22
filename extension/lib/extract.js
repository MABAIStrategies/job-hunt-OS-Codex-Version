// Functions injected into the job page with chrome.scripting.executeScript.
// Each must be fully self-contained (no references to outer scope).

export function extractJobPosting() {
  const clean = (s) => (s || '').replace(/\s+\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  const txt = (sel) => { const el = document.querySelector(sel); return el ? clean(el.innerText) : ''; };
  const url = location.href;
  const host = location.hostname;

  // 1) schema.org JobPosting (LinkedIn, Indeed, Greenhouse, Lever, Workday, most career sites)
  let ld = null;
  for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const data = JSON.parse(s.textContent);
      const list = Array.isArray(data) ? data : data['@graph'] || [data];
      ld = list.find((x) => x && (x['@type'] === 'JobPosting' || (Array.isArray(x['@type']) && x['@type'].includes('JobPosting'))));
      if (ld) break;
    } catch { /* ignore */ }
  }
  // DOMParser builds an inert document, so markup inside the JD can't execute.
  const htmlToText = (h) => {
    const doc = new DOMParser().parseFromString(String(h || '').replace(/<(br|\/p|\/li|\/h\d)\s*\/?>/gi, '\n$&'), 'text/html');
    return clean(doc.body.textContent);
  };

  // 2) Known boards
  const SITES = [
    { test: /linkedin\.com/, title: '.job-details-jobs-unified-top-card__job-title, .top-card-layout__title, h1', company: '.job-details-jobs-unified-top-card__company-name, .topcard__org-name-link', loc: '.job-details-jobs-unified-top-card__primary-description-container, .topcard__flavor--bullet', desc: '#job-details, .jobs-description__content, .description__text' },
    { test: /indeed\.com/, title: 'h1.jobsearch-JobInfoHeader-title, h1', company: '[data-testid="inlineHeader-companyName"], [data-company-name]', loc: '[data-testid="inlineHeader-companyLocation"], [data-testid="job-location"]', desc: '#jobDescriptionText' },
    { test: /greenhouse\.io/, title: 'h1, .app-title', company: '.company-name, .job__company', loc: '.location, .job__location', desc: '#content, .job__description, #app_body' },
    { test: /lever\.co/, title: '.posting-headline h2, h2', company: '.main-header-logo img[alt]', loc: '.posting-categories .location, .location', desc: '.section-wrapper.page-full-width, .posting-page' },
    { test: /myworkdayjobs\.com|workday/, title: '[data-automation-id="jobPostingHeader"], h2', company: '', loc: '[data-automation-id="locations"]', desc: '[data-automation-id="jobPostingDescription"]' },
    { test: /ashbyhq\.com/, title: 'h1', company: '', loc: '[class*="location"]', desc: '[class*="descriptionText"], main' },
    { test: /glassdoor\./, title: '[data-test="job-title"], h1', company: '[data-test="employer-name"]', loc: '[data-test="location"]', desc: '[class*="JobDetails_jobDescription"], #JobDescriptionContainer' },
    { test: /ziprecruiter\.com/, title: 'h1', company: '[class*="company"]', loc: '[class*="location"]', desc: '[class*="job_description"], .job_description' },
  ];
  const site = SITES.find((s) => s.test.test(host));

  let title = ld?.title || (site && txt(site.title)) || txt('h1') || document.title;
  let company = ld?.hiringOrganization?.name || (site && site.company && (site.company.includes('img') ? document.querySelector(site.company)?.alt : txt(site.company))) || '';
  const loc = ld?.jobLocation;
  const ldLoc = Array.isArray(loc) ? loc[0] : loc;
  let locationText = ldLoc?.address ? [ldLoc.address.addressLocality, ldLoc.address.addressRegion, ldLoc.address.addressCountry].filter(Boolean).join(', ') : '';
  if (ld?.jobLocationType === 'TELECOMMUTE') locationText = locationText ? `${locationText} (Remote)` : 'Remote';
  if (!locationText && site) locationText = txt(site.loc).split('\n')[0];

  let description = ld?.description ? htmlToText(ld.description) : '';
  if (!description && site) description = txt(site.desc);
  if (!description) {
    // 3) Generic fallback: the largest text block that reads like a JD
    const candidates = [...document.querySelectorAll('main, article, section, div')]
      .filter((el) => el.innerText && el.innerText.length > 600 && /responsibilit|requirement|qualification|experience|about the role/i.test(el.innerText))
      .sort((a, b) => a.innerText.length - b.innerText.length);
    description = clean((candidates[0] || document.body).innerText).slice(0, 20000);
  }
  const selection = clean(String(window.getSelection() || ''));
  if (selection.length > 300) description = selection;

  const ats = /myworkdayjobs|workday/.test(host) ? 'Workday' : /greenhouse/.test(host) ? 'Greenhouse' : /lever\.co/.test(host) ? 'Lever'
    : /ashbyhq/.test(host) ? 'Ashby' : /icims/.test(host) ? 'iCIMS' : /taleo/.test(host) ? 'Taleo' : /smartrecruiters/.test(host) ? 'SmartRecruiters'
    : /jobvite/.test(host) ? 'Jobvite' : /linkedin/.test(host) ? 'LinkedIn' : /indeed/.test(host) ? 'Indeed' : 'Unknown';
  const bodyText = document.body.innerText.slice(0, 50000);
  const easyApply = /easy apply|quick apply|indeed apply/i.test(bodyText.slice(0, 8000));
  const applyLink = [...document.querySelectorAll('a[href]')].find((a) => /apply/i.test(a.innerText) && !/easy apply/i.test(a.innerText));

  return {
    url, host, ats,
    title: clean(title).slice(0, 200),
    company: clean(company).slice(0, 120),
    location: clean(locationText).slice(0, 160),
    description: description.slice(0, 20000),
    datePosted: ld?.datePosted || '',
    salary: ld?.baseSalary ? JSON.stringify(ld.baseSalary) : '',
    applyUrl: applyLink?.href || url,
    easyApply,
    signalsText: bodyText.slice(0, 4000),
    fileInputs: document.querySelectorAll('input[type="file"]').length,
  };
}

export function extractJobCards() {
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const host = location.hostname;
  const abs = (href) => { try { return new URL(href, location.href).href; } catch { return ''; } };
  const pick = (el, sels) => { for (const s of sels) { const n = el.querySelector(s); if (n && clean(n.innerText)) return clean(n.innerText); } return ''; };

  const BOARDS = [
    { test: /linkedin\.com/, card: 'li[data-occludable-job-id], .job-card-container, .base-card, [data-job-id]', title: ['.job-card-list__title, .job-card-container__link strong', '.base-search-card__title', 'a strong', 'a'], company: ['.artdeco-entity-lockup__subtitle', '.job-card-container__primary-description', '.base-search-card__subtitle'], loc: ['.job-card-container__metadata-item', '.job-search-card__location', '.artdeco-entity-lockup__caption'], link: 'a[href*="/jobs/view"], a.base-card__full-link, a' },
    { test: /indeed\.com/, card: '.job_seen_beacon, [data-jk], .result', title: ['h2.jobTitle', 'h2 a', 'a[data-jk]'], company: ['[data-testid="company-name"]', '.companyName'], loc: ['[data-testid="text-location"]', '.companyLocation'], link: 'h2 a, a[data-jk]' },
    { test: /greenhouse\.io/, card: '.opening, tr.job-post, [class*="job-post"]', title: ['a', 'p'], company: [], loc: ['.location', 'p + p'], link: 'a' },
    { test: /lever\.co/, card: '.posting', title: ['h5', '[data-qa="posting-name"]'], company: [], loc: ['.location', '.sort-by-location'], link: 'a.posting-title, a' },
    { test: /glassdoor\./, card: '[data-test="jobListing"], li[class*="JobsList"]', title: ['[data-test="job-title"]', 'a[class*="JobCard_jobTitle"]'], company: ['[class*="EmployerProfile_compactEmployerName"]', '[class*="employer"]'], loc: ['[data-test="emp-location"]'], link: 'a[data-test="job-title"], a' },
    { test: /ziprecruiter\.com/, card: 'article, .job_result', title: ['h2', 'a'], company: ['[data-testid="job-card-company"]', '.company_name'], loc: ['[data-testid="job-card-location"]'], link: 'a' },
    { test: /wellfound\.com|angel\.co/, card: '[class*="JobSearchCard"], [data-test="StartupResult"]', title: ['a[class*="jobTitle"]', 'h4', 'a'], company: ['h2', 'a[class*="startup"]'], loc: ['[class*="location"]'], link: 'a[href*="/jobs/"], a' },
    { test: /myworkdayjobs\.com/, card: 'li[class*="css"] [data-automation-id="jobTitle"]', title: [], company: [], loc: [], link: 'a' },
  ];
  const board = BOARDS.find((b) => b.test.test(host));
  const seen = new Set();
  const cards = [];

  const push = (c) => { const key = c.url || c.title; if (!c.title || c.title.length < 4 || seen.has(key)) return; seen.add(key); cards.push(c); };

  if (board) {
    for (const el of document.querySelectorAll(board.card)) {
      const linkEl = el.matches('a') ? el : el.querySelector(board.link);
      const title = board.title.length ? pick(el, board.title) : clean(el.innerText);
      push({
        title: title.split('\n')[0].slice(0, 160),
        company: pick(el, board.company),
        location: pick(el, board.loc),
        snippet: clean(el.innerText).slice(0, 600),
        url: linkEl ? abs(linkEl.getAttribute('href')) : '',
      });
    }
  }
  if (cards.length < 3) {
    // Generic: links that look like job postings
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.getAttribute('href') || '';
      if (!/job|career|position|opening|posting|vacanc|req/i.test(href)) continue;
      const t = clean(a.innerText);
      if (t.length < 6 || t.length > 140) continue;
      const box = a.closest('li, article, tr, [class*="card"], [class*="job"]') || a.parentElement;
      push({ title: t, company: '', location: '', snippet: clean(box?.innerText || t).slice(0, 600), url: abs(href) });
    }
  }
  cards.forEach((c, i) => { c.id = `c${i}`; });
  return { url: location.href, host, cards: cards.slice(0, 150) };
}

export function paintBadges(results) {
  document.querySelectorAll('.jhos-badge').forEach((n) => n.remove());
  const byUrl = new Map(results.map((r) => [r.url, r]));
  for (const a of document.querySelectorAll('a[href]')) {
    let href;
    try { href = new URL(a.getAttribute('href'), location.href).href; } catch { continue; }
    const r = byUrl.get(href);
    if (!r || a.dataset.jhosPainted) continue;
    a.dataset.jhosPainted = '1';
    const b = document.createElement('span');
    b.className = 'jhos-badge';
    const color = r.locked ? '#6b7280' : r.prob >= 0.75 ? '#059669' : r.prob >= 0.5 ? '#2563eb' : '#d97706';
    b.textContent = r.locked ? '🔒 Upgrade to see' : `${Math.round(r.prob * 100)}% interview odds`;
    b.title = r.reason || '';
    b.style.cssText = `display:inline-block;margin-left:8px;padding:2px 8px;border-radius:999px;font:600 11px/1.6 system-ui,sans-serif;color:#fff;background:${color};vertical-align:middle;white-space:nowrap`;
    a.after(b);
    byUrl.delete(href);
  }
}

// Puts generated files into the page's <input type="file"> fields
// (Greenhouse / Lever / Workday / Ashby uploads). target: 'resume' | 'cover'.
export function attachFilesToPage(files) {
  const inputs = [...document.querySelectorAll('input[type="file"]')];
  if (!inputs.length) return { ok: false, reason: 'No file upload fields found on this page.' };
  const labelFor = (inp) => {
    const id = inp.id && document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
    const box = inp.closest('[class*="field"], fieldset, .form-group, div');
    return `${id?.innerText || ''} ${inp.name || ''} ${inp.getAttribute('aria-label') || ''} ${box?.innerText?.slice(0, 120) || ''}`.toLowerCase();
  };
  const toFile = (f) => {
    const bin = atob(f.base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new File([bytes], f.name, { type: f.mime });
  };
  const done = [];
  for (const f of files) {
    const want = f.kind === 'cover' ? /cover/ : /resume|cv/;
    const target = inputs.find((i) => want.test(labelFor(i)) && !i.dataset.jhosFilled)
      || (f.kind === 'resume' ? inputs.find((i) => !/cover/.test(labelFor(i)) && !i.dataset.jhosFilled) : null);
    if (!target) continue;
    const dt = new DataTransfer();
    dt.items.add(toFile(f));
    target.files = dt.files;
    target.dataset.jhosFilled = '1';
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    done.push(f.kind);
  }
  return { ok: done.length > 0, attached: done, reason: done.length ? '' : 'Could not match upload fields — drag the file instead.' };
}
