import * as store from './lib/storage.js';
import { callAIJSON, PROVIDERS, providerConfig, listModels } from './lib/ai.js';
import { PROFILE_SYSTEM, TAILOR_SYSTEM, SCAN_SYSTEM, profileDigest } from './lib/prompts.js';
import { extractJobPosting, extractJobCards, paintBadges, attachFilesToPage } from './lib/extract.js';
import { likelihood, explain, prefilterScore, parseSignals } from './lib/scoring.js';
import { PLANS, BANDS, planFor, bandFor, isUnlocked } from './lib/plans.js';
import { buildResumeModel } from './lib/truth.js';
import { renderResumePDF, renderCoverLetterPDF, plainTextResume, fileBase, SCHEMES } from './lib/render.js';
import { bytesToBase64 } from './lib/pdf.js';
import * as sheets from './lib/sheets.js';

const DAY = 86400000;
const $view = document.getElementById('view');
const state = { view: 'tailor', settings: null, profile: null, job: null, pkg: null, model: null, docs: null, app: null, scan: null };

// ---------- tiny DOM helper (textContent only: page/model text is never parsed as HTML) ----------
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid instanceof Node ? kid : String(kid));
  return el;
}
const card = (...kids) => h('div', { class: 'card' }, ...kids);
const pct = (x) => `${Math.round(x * 100)}%`;

function toast(msg, err = false) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.className = `toast${err ? ' err' : ''}`; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 6000 : 2600);
}

async function busy(btn, label, fn) {
  const prev = btn.textContent;
  btn.disabled = true; btn.replaceChildren(h('span', { class: 'spinner' }), ` ${label}`);
  try { return await fn(); } catch (e) { console.error(e); toast(e.message || String(e), true); } finally { btn.disabled = false; btn.textContent = prev; }
}

async function copy(text, what = 'Copied') { await navigator.clipboard.writeText(text); toast(what); }

async function activeTab() { const [t] = await chrome.tabs.query({ active: true, currentWindow: true }); return t; }

// Ask for host access to the current site (must run inside a click).
async function ensureAccess(url, broad = false) {
  if (!/^https?:/.test(url || '')) throw new Error('Open a job page (http/https) first.');
  const origins = broad ? ['https://*/*'] : [`${new URL(url).origin}/*`];
  if (await chrome.permissions.contains({ origins })) return;
  if (!(await chrome.permissions.request({ origins }))) throw new Error('Permission is needed to read this page.');
}

async function runInTab(tabId, func, args = []) {
  const [res] = await chrome.scripting.executeScript({ target: { tabId }, func, args });
  return res?.result;
}

// ---------- navigation ----------
document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
document.getElementById('planBadge').addEventListener('click', () => go('settings'));

function go(view) {
  state.view = view;
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === view));
  render();
}

function render() {
  const plan = planFor(state.settings);
  document.getElementById('planBadge').textContent = plan.name;
  // Hard gate: nothing works until a resume is on file.
  const gated = !state.profile && state.view !== 'settings';
  document.querySelectorAll('.tabs button').forEach((b) => (b.disabled = !state.profile && b.dataset.view !== 'tailor' && b.dataset.view !== 'settings'));
  $view.replaceChildren(...(gated ? viewOnboarding() : { tailor: viewTailor, scan: viewScan, pipeline: viewPipeline, settings: viewSettings }[state.view]()));
}

// ---------- onboarding: resume first, always ----------
function viewOnboarding() {
  const s = state.settings;
  const prov = providerSelect(s.provider);
  const key = h('input', { type: 'password', placeholder: PROVIDERS[s.provider].keyHint, value: s.keys[s.provider] || '', autocomplete: 'off' });
  prov.addEventListener('change', () => { key.placeholder = PROVIDERS[prov.value].keyHint; key.value = s.keys[prov.value] || ''; });
  const file = h('input', { type: 'file', accept: '.pdf,.txt,.md,application/pdf,text/plain' });
  const paste = h('textarea', { placeholder: '…or paste your resume text here' });
  const photo = h('input', { type: 'file', accept: 'image/*' });
  const buildBtn = h('button', { class: 'btn primary' }, 'Build my master profile');
  buildBtn.addEventListener('click', () => busy(buildBtn, 'Reading your resume…', async () => {
    state.settings = await store.saveSettings({ provider: prov.value, keys: { ...state.settings.keys, [prov.value]: key.value.trim() } });
    const f = file.files[0];
    if (!f && paste.value.trim().length < 200) throw new Error('Upload your resume (PDF or TXT) or paste it first.');
    if (f && /\.docx?$/i.test(f.name)) throw new Error('Please export your resume as PDF (Word files are not supported yet).');
    if (photo.files[0]) await store.saveHeadshot(await toJpegSquare(photo.files[0]));
    await buildProfile(f, paste.value.trim());
    toast(`Profile ready for ${state.profile.personal?.name || 'you'}`);
    render();
  }));
  return [
    h('div', { class: 'card gate' },
      h('div', { class: 'big' }, 'Start with your resume'),
      h('p', { class: 'muted' }, 'Upload your master resume once. Every tailored resume, cover letter, and job match is built from it. Employers, titles, and dates are locked and never changed.')),
    card(
      h('label', {}, 'AI provider', prov),
      h('label', {}, 'API key (stored only on this device)', key),
      h('p', { class: 'muted' }, "Groq, NVIDIA NIM and Grok can't read PDFs — paste your resume text instead, or add a Gemini/OpenAI/OpenRouter/Claude key in Settings for this step."),
      h('label', {}, 'Master resume', file), paste,
      h('label', {}, 'Professional headshot (optional)', photo),
      buildBtn,
      h('p', { class: 'muted' }, 'Your resume is sent to your chosen AI provider only to build your profile and documents. Nothing is shared with employers until you choose to.')),
  ];
}

async function buildProfile(file, pastedText) {
  const content = [];
  if (file && /pdf$/i.test(file.type || file.name)) {
    const b64 = bytesToBase64(new Uint8Array(await file.arrayBuffer()));
    content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } });
  } else {
    content.push({ type: 'text', text: `RESUME:\n${file ? await file.text() : pastedText}` });
  }
  content.push({ type: 'text', text: 'Build the master profile JSON. Also add a "source_text" field containing the full resume as plain text, verbatim.' });
  const profile = await callAIJSON({ settings: state.settings, system: PROFILE_SYSTEM, content, maxTokens: 12000 });
  if (!profile.experience?.length) throw new Error('Could not find work experience in that resume. Try the pasted-text option.');
  await store.saveProfile(profile);
  state.profile = await store.getProfile();
}

async function toJpegSquare(file, size = 480) {
  const bmp = await createImageBitmap(file);
  const side = Math.min(bmp.width, bmp.height);
  const c = new OffscreenCanvas(size, size);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
  ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2.6, side, side, 0, 0, size, size);
  const blob = await c.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
  const dataUrl = await new Promise((r) => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  return { dataUrl, w: size, h: size };
}

// ---------- Tailor (use case 1) ----------
function viewTailor() {
  const out = [];
  const capture = h('button', { class: 'btn primary' }, state.job ? 'Re-capture this page' : 'Capture job from this page');
  capture.addEventListener('click', () => busy(capture, 'Reading job…', () => captureJob()));
  const p = state.profile;
  out.push(card(
    h('div', { class: 'row spread' }, h('h2', {}, 'Tailor to this job'), h('span', { class: 'muted' }, `${p.personal?.name} · ${p.experience.length} roles`)),
    h('p', { class: 'muted' }, 'Open any job description (LinkedIn, Indeed, Greenhouse, Lever, Workday, Ashby, company sites), then capture it. You can also highlight text and right-click.'),
    capture));

  if (state.job) {
    const j = state.job;
    const jd = h('textarea', { class: 'edit', rows: 6 }, j.description);
    jd.addEventListener('change', () => (j.description = jd.value));
    const build = h('button', { class: 'btn primary' }, state.pkg ? 'Rebuild package' : 'Build resume + cover letter');
    build.addEventListener('click', () => busy(build, 'Tailoring (≈30–60s)…', () => buildPackage()));
    out.push(card(
      h('div', { class: 'row spread' }, h('h2', {}, j.title || 'Untitled role'), h('span', { class: 'pill' }, j.ats)),
      h('div', { class: 'muted' }, [j.company, j.location, j.easyApply ? 'Easy Apply' : null].filter(Boolean).join(' · ')),
      h('details', {}, h('summary', {}, `Job description (${j.description.length.toLocaleString()} chars, editable)`), jd),
      build));
  }
  if (state.pkg) out.push(...viewPackage());
  return out;
}

async function captureJob(selection) {
  const tab = await activeTab();
  // activeTab (context menu / shortcut) may already grant access; only prompt if needed.
  let job = await runInTab(tab.id, extractJobPosting).catch(() => null);
  if (!job) { await ensureAccess(tab.url); job = await runInTab(tab.id, extractJobPosting); }
  if (!job) throw new Error('Could not read this page.');
  if (selection && selection.length > 200) job.description = selection;
  if ((job.description || '').length < 200) throw new Error('No job description found here. Highlight the description and right-click → "Tailor my resume…", or paste it.');
  state.job = job; state.pkg = null; state.docs = null; state.app = null;
  render();
}

async function buildPackage() {
  const s = state.settings, plan = planFor(s);
  const used = await store.getUsage('package');
  if (used.month >= plan.packagesPerMonth) throw new Error(`${plan.name} includes ${plan.packagesPerMonth} packages/month. Upgrade in Settings for more.`);
  const { source_text, ...profile } = state.profile;
  const j = state.job;
  const content = [{ type: 'text', text:
    `MASTER PROFILE (source of truth; experience is indexed from 0):\n${JSON.stringify(profile)}\n\n` +
    `JOB POSTING\nURL: ${j.url}\nDetected ATS: ${j.ats}\nEasy Apply: ${j.easyApply}\nTitle: ${j.title}\nCompany: ${j.company}\nLocation: ${j.location}\nPosted: ${j.datePosted}\nSalary data: ${j.salary}\n\n${j.description}` }];
  const webSearch = s.liveResearch && plan.liveResearch;
  if (webSearch) content.push({ type: 'text', text: 'Use web search to check current compensation signals and recent company news for the hook. Then return the JSON.' });
  const pkg = await callAIJSON({ settings: s, system: TAILOR_SYSTEM, content, maxTokens: 16000, webSearch });
  await store.bumpUsage('package');
  state.pkg = pkg;
  state.model = buildResumeModel(state.profile, pkg);
  await makeDocs();
  const prob = likelihood(pkg.likelihood || {}, parseSignals(j.signalsText));
  state.app = await store.upsertApplication({
    job_id: state.app?.job_id || store.newJobId(),
    company: pkg.job?.company || j.company, title: pkg.job?.title || j.title,
    source_url: j.url, apply_url: j.applyUrl, easy_apply: j.easyApply,
    status: 'package generated', likelihood: prob, pkg, jd_text: j.description,
  });
  render();
  if (s.sheetWebAppUrl) syncToSheet().catch((e) => toast(`Sheet: ${e.message}`, true));
}

async function makeDocs() {
  const s = state.settings, pkg = state.pkg, model = state.model;
  const scheme = SCHEMES[pkg.color_scheme] || SCHEMES.tech_navy;
  const direct = ['direct', 'referral'].includes(pkg.job?.application_method);
  const useHead = s.headshotMode === 'always' || (s.headshotMode === 'direct_only' && direct);
  const headshot = useHead ? await store.getHeadshot() : null;
  const base = fileBase(model.personal, pkg.job || {});
  const mk = (bytes, name, mime, kind) => {
    const blob = new Blob([bytes], { type: mime });
    return { kind, name, mime, bytes, blob, url: URL.createObjectURL(blob), file: new File([blob], name, { type: mime }) };
  };
  state.docs?.forEach?.((d) => URL.revokeObjectURL(d.url));
  const resume = renderResumePDF(model, { scheme, headshot });
  const cover = renderCoverLetterPDF(model, pkg, { scheme });
  const txt = new TextEncoder().encode(plainTextResume(model));
  state.docs = [
    mk(resume, `${base}_Resume.pdf`, 'application/pdf', 'resume'),
    mk(cover, `${base}_CoverLetter.pdf`, 'application/pdf', 'cover'),
    mk(txt, `${base}_Resume_ATS.txt`, 'text/plain', 'txt'),
  ];
}

function docChip(d) {
  const shared = state.app?.links?.[d.kind];
  const el = h('div', { class: 'doc', draggable: 'true', title: 'Drag onto an upload box or your desktop' },
    h('div', { class: `ico ${d.kind === 'txt' ? 'txt' : ''}` }, d.kind === 'txt' ? 'TXT' : 'PDF'),
    h('div', { class: 'meta' },
      h('div', { class: 'name' }, d.name),
      h('div', { class: 'muted' }, `${(d.bytes.length / 1024).toFixed(0)} KB · drag to upload`)),
  );
  el.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('DownloadURL', `${d.mime}:${d.name}:${d.url}`); // desktop / file managers
    try { e.dataTransfer.items.add(d.file); } catch { /* not supported everywhere */ }
    if (shared) e.dataTransfer.setData('text/uri-list', shared);
  });
  const actions = h('div', { class: 'row' },
    h('button', { class: 'btn small', onclick: () => chrome.tabs.create({ url: d.url }) }, 'Preview'),
    h('button', { class: 'btn small', onclick: () => download(d) }, 'Download'),
    d.kind !== 'txt' ? h('button', { class: 'btn small', onclick: (ev) => busy(ev.target, 'Attaching…', () => attach([d])) }, 'Attach to page') : null,
    d.kind === 'txt' ? h('button', { class: 'btn small', onclick: () => copy(new TextDecoder().decode(d.bytes), 'ATS text copied') }, 'Copy text') : null,
    shared ? h('button', { class: 'btn small', onclick: () => copy(shared, 'Share link copied') }, 'Copy link') : null);
  return h('div', {}, el, actions);
}

function download(d) {
  const a = h('a', { href: d.url, download: d.name }); document.body.append(a); a.click(); a.remove();
}

async function attach(docs) {
  const tab = await activeTab();
  await ensureAccess(tab.url);
  const files = docs.map((d) => ({ kind: d.kind, name: d.name, mime: d.mime, base64: bytesToBase64(d.bytes) }));
  const r = await runInTab(tab.id, attachFilesToPage, [files]);
  if (!r?.ok) throw new Error(r?.reason || 'Could not attach.');
  toast(`Attached: ${r.attached.join(' + ')}`);
}

function viewPackage() {
  const pkg = state.pkg, m = state.model, a = pkg.ats || {};
  const prob = state.app?.likelihood ?? likelihood(pkg.likelihood || {});
  const band = bandFor(prob);
  const out = [];

  out.push(card(
    h('div', { class: 'row spread' }, h('h2', {}, 'Match report'), band ? h('span', { class: `prob ${band.cls}` }, `${pct(prob)} interview odds`) : h('span', { class: 'muted' }, `${pct(prob)} interview odds`)),
    h('div', { class: 'muted' }, `ATS keyword match before: ${a.before ?? '?'}%`), h('div', { class: 'meter' }, h('i', { style: `width:${a.before || 0}%` })),
    h('div', { class: 'muted' }, `After tailoring: ${a.after ?? '?'}%`), h('div', { class: 'meter after' }, h('i', { style: `width:${a.after || 0}%` })),
    (pkg.likelihood?.reasons || []).length ? h('ul', { class: 'clean muted' }, pkg.likelihood.reasons.slice(0, 4).map((r) => h('li', {}, r))) : null,
    (a.missing || []).length ? h('div', {}, h('h3', {}, 'Keyword gaps'), h('div', { class: 'row' }, a.missing.slice(0, 18).map((k) => h('span', { class: `pill ${k.priority}`, title: k.where }, k.keyword)))) : null,
    (a.unsupported || []).length ? h('div', { class: 'muted' }, `Not claimed (no evidence in your resume): ${a.unsupported.join(', ')}`) : null,
    ...(a.red_flags || []).map((f) => h('div', { class: `flag ${f.severity === 'high' ? 'bad' : ''}` }, h('b', {}, f.flag), ` — ${f.detail}`, f.handled ? h('div', { class: 'muted' }, `Handled: ${f.handled}`) : null)),
  ));

  if (m.flags.length) out.push(card(h('h2', {}, 'Truth Lock review'),
    h('p', { class: 'muted' }, 'These numbers were not found in your master resume. Edit or confirm before sending.'),
    ...m.flags.map((f) => h('div', { class: 'flag bad' }, h('b', {}, f.where), `: ${f.metrics.join(', ')}`, h('div', { class: 'muted' }, f.text)))));

  const applied = h('button', { class: 'btn primary' }, state.app?.applied_at ? 'Applied ✓' : 'I applied — start follow-ups');
  applied.addEventListener('click', () => busy(applied, 'Saving…', markApplied));
  const attachBoth = h('button', { class: 'btn' }, 'Attach both to page');
  attachBoth.addEventListener('click', () => busy(attachBoth, 'Attaching…', () => attach(state.docs.filter((d) => d.kind !== 'txt'))));
  const sync = h('button', { class: 'btn' }, state.app?.links ? 'Re-sync to Sheet' : 'Save to Drive + Sheet');
  sync.addEventListener('click', () => busy(sync, 'Syncing…', syncToSheet));
  out.push(card(h('h2', {}, 'Your documents'),
    h('p', { class: 'muted' }, 'Drag a file straight onto the application\'s upload box, or click "Attach to page".'),
    ...state.docs.map(docChip),
    h('div', { class: 'row' }, attachBoth, sync, applied)));

  out.push(card(h('h2', {}, 'Edit before sending'), ...editors()));

  const o = pkg.outreach || {};
  out.push(card(h('h2', {}, 'Follow-up drafts'),
    h('p', { class: 'muted' }, 'Cadence: recruiter today → hiring manager +1 day → peer +3 days. Nothing is sent for you.'),
    ...[['Recruiter (T0)', o.recruiter], ['Hiring manager (T+1)', o.hiring_manager], ['Peer (T+3)', o.peer]].filter(([, v]) => v).map(([k, v]) =>
      h('details', {}, h('summary', {}, k), h('div', { class: 'copybox' }, v), h('button', { class: 'btn small', onclick: () => copy(v) }, 'Copy')))));

  const c = pkg.compensation || {};
  const money = (n) => (n ? `$${Math.round(n / 1000)}k` : '?');
  out.push(card(h('h2', {}, 'Intel'),
    c.base_low ? h('div', {}, h('b', {}, 'Comp estimate: '), `base ${money(c.base_low)}–${money(c.base_high)}, total ${money(c.total_low)}–${money(c.total_high)} (${c.confidence} confidence)`, c.note ? h('div', { class: 'muted' }, c.note) : null) : null,
    pkg.linkedin?.headline ? h('div', {}, h('b', {}, 'LinkedIn headline: '), pkg.linkedin.headline, ' ', h('button', { class: 'btn small', onclick: () => copy(pkg.linkedin.headline) }, 'Copy')) : null,
    h('details', {}, h('summary', {}, 'Likely interview questions'),
      planFor(state.settings).interviewPrep
        ? h('ol', {}, (pkg.interview || []).map((q) => h('li', {}, h('b', {}, q.question), h('div', { class: 'muted' }, `Why: ${q.why}`), h('div', { class: 'muted' }, `Use: ${q.hook}`))))
        : h('p', { class: 'muted' }, `Preview: “${pkg.interview?.[0]?.question || ''}” — full prep is on Pro.`)),
    h('details', {}, h('summary', {}, 'What changed and why'), h('ul', { class: 'clean' }, (pkg.changes_log || []).map((l) => h('li', {}, h('b', {}, l.section), `: ${l.change} — `, h('span', { class: 'muted' }, l.reason))))),
    h('div', { class: 'row' },
      h('button', { class: 'btn small', onclick: () => designIn('https://www.canva.com/resumes/templates/') }, 'Restyle in Canva'),
      h('button', { class: 'btn small', onclick: () => designIn('https://new.express.adobe.com/search?q=resume') }, 'Restyle in Adobe Express'))));
  return out;
}

async function designIn(url) {
  await navigator.clipboard.writeText(plainTextResume(state.model));
  chrome.tabs.create({ url });
  toast('Resume text copied — paste it into a template.');
}

function editors() {
  const m = state.model, pkg = state.pkg;
  const rebuild = h('button', { class: 'btn primary small' }, 'Rebuild PDFs');
  rebuild.addEventListener('click', () => busy(rebuild, 'Rendering…', async () => { await makeDocs(); render(); toast('PDFs updated'); }));
  const field = (label, get, set, rows = 2) => {
    const t = h('textarea', { rows }, get());
    t.addEventListener('change', () => set(t.value));
    return h('label', {}, label, t);
  };
  return [
    field('Headline', () => m.headline, (v) => (m.headline = v), 1),
    field('Summary', () => m.summary, (v) => (m.summary = v), 4),
    h('details', {}, h('summary', {}, 'Experience bullets (one per line — titles, employers and dates are locked)'),
      ...m.experience.map((e) => field(`${e.title} · ${e.company} · ${e.dates}`, () => e.bullets.join('\n'), (v) => (e.bullets = v.split('\n').map((x) => x.trim()).filter(Boolean)), 5))),
    h('details', {}, h('summary', {}, 'Cover letter'),
      ...(pkg.cover_letter?.paragraphs || []).map((_, i) => field(`Paragraph ${i + 1}`, () => pkg.cover_letter.paragraphs[i], (v) => (pkg.cover_letter.paragraphs[i] = v), 4))),
    rebuild,
  ];
}

async function markApplied() {
  const now = Date.now();
  state.app = await store.upsertApplication({
    job_id: state.app.job_id, status: 'applied', applied_at: now,
    follow_up_stage: 'recruiter', follow_up_stage_label: 'Message the recruiter', next_follow_up: now,
  });
  if (state.settings.sheetWebAppUrl) await sheets.updateApplication(state.settings, state.app.job_id, sheets.trackerRecord(state.app)).catch(() => syncToSheet());
  toast('Logged as applied. Recruiter follow-up is due today.');
  render();
}

async function syncToSheet() {
  const s = state.settings;
  if (!s.sheetWebAppUrl) { go('settings'); throw new Error('Connect your Google Sheet first.'); }
  const files = state.docs.filter((d) => d.kind !== 'txt').map((d) => ({ kind: d.kind, name: d.name, mime: d.mime, base64: bytesToBase64(d.bytes) }));
  const r = await sheets.logApplication(s, sheets.trackerRecord(state.app), files);
  state.app = await store.upsertApplication({ job_id: state.app.job_id, links: r.links, sheet_row: r.row });
  toast('Saved to Drive and logged in your tracker');
  render();
}

// ---------- Find Jobs (use case 2) ----------
function viewScan() {
  const s = state.settings, plan = planFor(s);
  const btn = h('button', { class: 'btn primary' }, 'Scan this job board');
  btn.addEventListener('click', () => busy(btn, 'Scoring jobs…', runScan));
  const floor = h('select', {}, BANDS.slice().reverse().map((b) => h('option', { value: b.min, selected: Number(s.minConfidence) === b.min }, `Show ${Math.round(b.min * 100)}%+ matches`)));
  floor.addEventListener('change', async () => { state.settings = await store.saveSettings({ minConfidence: Number(floor.value) }); render(); });
  const out = [card(
    h('div', { class: 'row spread' }, h('h2', {}, 'Find jobs you can land'), h('span', { class: 'muted' }, `${plan.scansPerDay} scans/day · deep-reads ${plan.deepScan}`)),
    h('p', { class: 'muted' }, 'Open a search results page (LinkedIn, Indeed, Glassdoor, ZipRecruiter, Wellfound, Greenhouse/Lever boards, career sites) and scan. Each job gets an estimated interview likelihood from your resume.'),
    h('div', { class: 'row' }, btn, floor))];
  if (state.scan) out.push(...viewScanResults());
  return out;
}

async function runScan() {
  const s = state.settings, plan = planFor(s);
  const used = await store.getUsage('scan');
  if (used.today >= plan.scansPerDay) throw new Error(`${plan.name} includes ${plan.scansPerDay} scans/day. Upgrade for more.`);
  const tab = await activeTab();
  await ensureAccess(tab.url, plan.deepScan > 0);
  const page = await runInTab(tab.id, extractJobCards);
  if (!page?.cards?.length) throw new Error('No job listings found on this page. Try a search results page.');

  const ranked = page.cards.map((c) => ({ ...c, pre: prefilterScore(c, state.profile) })).sort((a, b) => b.pre - a.pre).slice(0, plan.cardsPerScan);
  // Deep scan: fetch full postings for the top N so the estimate rests on the real JD.
  await Promise.all(ranked.slice(0, plan.deepScan).filter((c) => c.url).map(async (c) => {
    try {
      const html = await (await fetch(c.url, { credentials: 'include', signal: AbortSignal.timeout(8000) })).text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      doc.querySelectorAll('script, style, nav, footer, header').forEach((n) => n.remove());
      const text = (doc.body?.textContent || '').replace(/\s+/g, ' ').trim();
      if (text.length > 400) { c.snippet = text.slice(0, 3500); c.deep = true; }
    } catch { /* keep card snippet */ }
  }));

  const digest = profileDigest(state.profile);
  const results = [];
  for (let i = 0; i < ranked.length; i += 20) {
    const batch = ranked.slice(i, i + 20);
    const jobs = batch.map((c) => ({ id: c.id, title: c.title, company: c.company, location: c.location, text: c.snippet.slice(0, c.deep ? 3500 : 600) }));
    const r = await callAIJSON({ settings: s, fast: true, system: SCAN_SYSTEM, maxTokens: 6000,
      content: [{ type: 'text', text: `CANDIDATE:\n${JSON.stringify(digest)}\n\nJOBS:\n${JSON.stringify(jobs)}` }] });
    const byId = new Map((r.results || []).map((x) => [x.id, x]));
    for (const c of batch) {
      const f = byId.get(c.id);
      if (!f) continue;
      const sig = parseSignals(c.snippet);
      const prob = likelihood(f, sig);
      results.push({ ...c, f, sig, prob, reason: f.reason, why: explain(f, sig), locked: !isUnlocked(prob, plan) });
    }
  }
  await store.bumpUsage('scan');
  results.sort((a, b) => b.prob - a.prob);
  state.scan = { page: page.url, tabId: tab.id, total: page.cards.length, results, at: Date.now() };
  const minC = Number(s.minConfidence) || 0.3;
  await runInTab(tab.id, paintBadges, [results.filter((r) => r.prob >= minC).map((r) => ({ url: r.url, prob: r.prob, reason: r.reason, locked: r.locked }))]).catch(() => {});
  if (s.sheetWebAppUrl) sheets.logScan(s, results.filter((r) => r.prob >= minC && !r.locked).map((r) => ({
    scanned_at: new Date().toISOString(), title: r.title, company: r.company, location: r.location, url: r.url,
    interview_likelihood: Math.round(r.prob * 100), band: bandFor(r.prob)?.label || '', reason: r.reason, source_page: page.url,
  }))).catch(() => {});
  render();
}

function viewScanResults() {
  const s = state.settings, plan = planFor(s), sc = state.scan;
  const minC = Number(s.minConfidence) || 0.3;
  const shown = sc.results.filter((r) => r.prob >= minC);
  const out = [h('div', { class: 'muted' }, `${sc.total} listings found · ${sc.results.length} scored · ${shown.length} at ${pct(minC)}+`)];
  for (const band of BANDS) {
    const list = shown.filter((r) => bandFor(r.prob) === band);
    if (!list.length) continue;
    const locked = list.filter((r) => r.locked);
    out.push(card(
      h('div', { class: `band-head ${band.cls}` }, `${band.label} (${list.length})`),
      locked.length ? h('div', { class: 'flag' }, `${locked.length} job${locked.length > 1 ? 's' : ''} in this band unlock on ${PLANS[band.plan].name} ($${PLANS[band.plan].price}/mo). `,
        h('button', { class: 'btn small', onclick: () => go('settings') }, 'See plans')) : null,
      ...list.map(jobRow)));
  }
  if (!shown.length) out.push(card(h('p', { class: 'muted' }, 'No strong matches on this page. Try a broader search, or lower the filter.')));
  return out;
}

function jobRow(r) {
  const tailor = h('button', { class: 'btn small primary' }, 'Tailor for this');
  tailor.addEventListener('click', () => busy(tailor, 'Opening…', () => openAndTailor(r.url)));
  return h('div', { class: `job ${r.locked ? 'locked' : ''}` },
    h('div', { class: 'row spread' }, h('span', { class: 'title' }, r.title), h('span', { class: `prob ${bandFor(r.prob)?.cls || ''}` }, r.locked ? '🔒' : pct(r.prob))),
    h('div', { class: 'sub muted' }, [r.company, r.location, r.deep ? 'full JD read' : null].filter(Boolean).join(' · ')),
    r.locked ? null : h('div', { class: 'muted' }, r.reason),
    r.locked || !r.why.length ? null : h('div', { class: 'row' }, r.why.map((w) => h('span', { class: 'pill' }, w))),
    r.locked ? null : h('div', { class: 'row' }, r.url ? h('button', { class: 'btn small', onclick: () => chrome.tabs.create({ url: r.url, active: false }) }, 'Open') : null, r.url ? tailor : null));
}

async function openAndTailor(url) {
  const tab = await activeTab();
  await chrome.tabs.update(tab.id, { url });
  await new Promise((resolve) => {
    const fn = (id, info) => { if (id === tab.id && info.status === 'complete') { chrome.tabs.onUpdated.removeListener(fn); resolve(); } };
    chrome.tabs.onUpdated.addListener(fn);
    setTimeout(resolve, 15000);
  });
  await new Promise((r) => setTimeout(r, 1200)); // let SPA boards render the JD
  go('tailor');
  await captureJob();
}

// ---------- Pipeline ----------
const STAGES = {
  recruiter: { label: 'Message the recruiter', key: 'recruiter', next: 'hiring_manager', wait: 1 },
  hiring_manager: { label: 'Message the hiring manager', key: 'hiring_manager', next: 'peer', wait: 2 },
  peer: { label: 'Reach out to a peer on the team', key: 'peer', next: 'done', wait: 0 },
};

function viewPipeline() {
  const holder = h('div', { style: 'display:grid;gap:12px' }, h('div', { class: 'muted' }, 'Loading…'));
  store.getApplications().then((apps) => {
    if (!apps.length) { holder.replaceChildren(card(h('p', { class: 'muted' }, 'No applications yet. Tailor your first one from a job page.'))); return; }
    const due = apps.filter((a) => a.next_follow_up && a.next_follow_up <= Date.now() && !a.response_received);
    holder.replaceChildren(
      card(h('div', { class: 'row spread' }, h('h2', {}, 'Pipeline'), h('span', { class: 'muted' }, `${apps.length} roles · ${due.length} follow-ups due`))),
      ...apps.map(appRow));
  });
  return [holder];
}

function appRow(a) {
  const stage = STAGES[a.follow_up_stage];
  const isDue = a.next_follow_up && a.next_follow_up <= Date.now() && !a.response_received;
  const draft = stage && a.pkg?.outreach?.[stage.key];
  const status = h('select', {}, ['package generated', 'applied', 'interviewing', 'offer', 'rejected', 'closed'].map((s) => h('option', { selected: a.status === s }, s)));
  status.addEventListener('change', () => patchApp(a, { status: status.value }));
  return card(
    h('div', { class: 'row spread' }, h('b', {}, `${a.title || 'Role'} — ${a.company || ''}`), a.likelihood ? h('span', { class: `prob ${bandFor(a.likelihood)?.cls || ''}` }, pct(a.likelihood)) : null),
    h('div', { class: 'row' }, status, a.links?.resume ? h('button', { class: 'btn small', onclick: () => copy(a.links.resume, 'Resume link copied') }, 'Resume link') : null,
      a.links?.cover ? h('button', { class: 'btn small', onclick: () => copy(a.links.cover, 'Cover letter link copied') }, 'Cover link') : null,
      a.source_url ? h('button', { class: 'btn small', onclick: () => chrome.tabs.create({ url: a.source_url }) }, 'Posting') : null),
    stage ? h('div', { class: isDue ? 'flag' : 'muted' }, `${isDue ? 'Due now' : `Next: ${new Date(a.next_follow_up).toLocaleDateString()}`} — ${stage.label}`) : null,
    draft ? h('details', {}, h('summary', {}, 'Draft message'), h('div', { class: 'copybox' }, draft)) : null,
    stage ? h('div', { class: 'row' },
      draft ? h('button', { class: 'btn small', onclick: () => copy(draft) }, 'Copy draft') : null,
      h('button', { class: 'btn small', onclick: () => advance(a) }, 'Mark sent'),
      h('button', { class: 'btn small', onclick: () => patchApp(a, { response_received: true, follow_up_stage: 'none', next_follow_up: null }) }, 'Got a reply')) : null);
}

async function advance(a) {
  const stage = STAGES[a.follow_up_stage];
  const next = STAGES[stage.next];
  await patchApp(a, next
    ? { follow_up_stage: stage.next, follow_up_stage_label: next.label, next_follow_up: Date.now() + stage.wait * DAY, last_contact_date: Date.now() }
    : { follow_up_stage: 'none', next_follow_up: null, last_contact_date: Date.now() });
}

async function patchApp(a, patch) {
  const updated = await store.upsertApplication({ job_id: a.job_id, ...patch });
  if (state.settings.sheetWebAppUrl) sheets.updateApplication(state.settings, a.job_id, sheets.trackerRecord(updated)).catch(() => {});
  render();
}

// ---------- AI provider settings ----------
function providerSelect(current) {
  return h('select', {}, Object.entries(PROVIDERS).map(([id, p]) => h('option', { value: id, selected: id === current }, p.label)));
}

function aiCard(live) {
  const s = state.settings;
  const active = providerConfig(s);
  const prov = providerSelect(s.provider);
  prov.addEventListener('change', async () => { state.settings = await store.saveSettings({ provider: prov.value }); render(); });

  const listId = 'jhos-models';
  const datalist = h('datalist', { id: listId });
  const modelInput = (field) => {
    const el = h('input', { type: 'text', value: active[field], list: listId });
    el.addEventListener('change', async () => {
      const models = { ...state.settings.models, [active.id]: { ...(state.settings.models[active.id] || {}), [field]: el.value.trim() } };
      state.settings = await store.saveSettings({ models }); toast('Saved');
    });
    return el;
  };
  const load = h('button', { class: 'btn small' }, 'Test key + load models');
  load.addEventListener('click', () => busy(load, 'Checking…', async () => {
    const ids = await listModels(state.settings, active.id);
    datalist.replaceChildren(...ids.map((m) => h('option', { value: m })));
    toast(`Key works — ${ids.length} models available`);
  }));

  const keyRows = Object.entries(PROVIDERS).map(([id, p]) => {
    const el = h('input', { type: 'password', value: s.keys[id] || '', placeholder: p.keyHint, autocomplete: 'off' });
    el.addEventListener('change', async () => { state.settings = await store.saveSettings({ keys: { ...state.settings.keys, [id]: el.value.trim() } }); toast('Key saved'); render(); });
    return h('label', {}, h('span', { class: 'row spread' }, p.label, h('a', { href: p.keyUrl, target: '_blank', class: 'muted' }, 'Get key')), el);
  });

  return card(h('h2', {}, 'AI provider'),
    h('label', {}, 'Use for writing + scanning', prov),
    active.key ? null : h('div', { class: 'flag bad' }, `Add a ${active.label} key below.`),
    h('label', {}, 'Writing model', modelInput('model')),
    h('label', {}, 'Scan model (fast, cheap)', modelInput('fastModel')),
    datalist, load,
    h('div', { class: 'muted' }, [active.pdf ? 'Reads PDFs' : 'Text only (no PDF upload)', active.search ? 'live web research' : 'no live web research'].join(' · ')),
    h('label', { class: 'row' }, live, `Live research: current comp + company news (Pro+${active.search ? '' : '; not available on this provider'})`),
    h('details', {}, h('summary', {}, `API keys (${Object.values(s.keys).filter(Boolean).length} saved)`),
      h('p', { class: 'muted' }, 'API keys are billed by each provider separately from ChatGPT Plus, Gemini Advanced or SuperGrok subscriptions. Keys stay on this device and go only to that provider.'),
      ...keyRows));
}

// ---------- Settings ----------
function viewSettings() {
  const s = state.settings;
  const inp = (key, attrs = {}) => {
    const el = h('input', { type: 'text', value: s[key] ?? '', ...attrs });
    el.addEventListener('change', async () => { state.settings = await store.saveSettings({ [key]: el.type === 'number' ? Number(el.value) : el.value.trim() }); toast('Saved'); });
    return el;
  };
  const sel = (key, opts) => {
    const el = h('select', {}, opts.map(([v, l]) => h('option', { value: v, selected: s[key] === v }, l)));
    el.addEventListener('change', async () => { state.settings = await store.saveSettings({ [key]: el.value }); render(); });
    return el;
  };
  const live = h('input', { type: 'checkbox', checked: s.liveResearch });
  live.addEventListener('change', async () => { state.settings = await store.saveSettings({ liveResearch: live.checked }); });
  const test = h('button', { class: 'btn small' }, 'Test connection');
  test.addEventListener('click', () => busy(test, 'Testing…', async () => { const r = await sheets.pingSheet(state.settings); toast(`Connected to "${r.sheet}"`); }));
  const reset = h('button', { class: 'btn small' }, 'Replace my resume');
  reset.addEventListener('click', async () => { await chrome.storage.local.remove('profile'); state.profile = null; state.job = state.pkg = null; go('tailor'); });
  const exportBtn = h('button', { class: 'btn small', onclick: () => {
    const blob = new Blob([JSON.stringify(state.profile, null, 2)], { type: 'application/json' });
    download({ url: URL.createObjectURL(blob), name: 'master_profile.json' });
  } }, 'Export profile');

  return [
    card(h('h2', {}, 'Plan'),
      ...Object.entries(PLANS).map(([id, p]) => h('div', { class: 'job' },
        h('div', { class: 'row spread' }, h('b', {}, `${p.name} — ${p.price ? `$${p.price}/mo` : 'Free'}`), s.plan === id ? h('span', { class: 'pill nice' }, 'Current') : null),
        h('div', { class: 'muted' }, `Matches unlocked: ${pct(p.unlockedFloor)}${p.unlockedCeiling > 1 ? '+ (all)' : `–${Math.round(p.unlockedCeiling * 100 - 1)}%`} · ${p.packagesPerMonth} packages/mo · ${p.scansPerDay} scans/day · ${p.deepScan ? `full-JD deep read of top ${p.deepScan}` : 'card-level scoring'}${p.liveResearch ? ' · live comp + company research' : ''}${p.interviewPrep ? ' · interview prep' : ''}`))),
      h('label', {}, 'License key', inp('licenseKey', { placeholder: 'Paste after purchase' })),
      h('label', {}, 'Plan (developer override until billing is live)', sel('plan', Object.entries(PLANS).map(([id, p]) => [id, p.name])))),
    aiCard(live),
    card(h('h2', {}, 'Google Sheet tracker'),
      h('p', { class: 'muted' }, 'Deploy apps-script/Code.gs from your tracker sheet as a web app, then paste its URL and token here. PDFs go to Drive and get share links you can paste into any application.'),
      h('label', {}, 'Web app URL', inp('sheetWebAppUrl', { type: 'url', placeholder: 'https://script.google.com/macros/s/…/exec' })),
      h('label', {}, 'Token', inp('sheetToken', { type: 'password' })),
      test),
    card(h('h2', {}, 'Documents & reminders'),
      h('label', {}, 'Headshot on resume', sel('headshotMode', [['direct_only', 'Only for direct / referral applications'], ['always', 'Always'], ['never', 'Never (ATS-safest)']])),
      h('label', {}, 'Follow-up reminder hour (0–23)', inp('followUpHour', { type: 'number', min: 0, max: 23 }))),
    card(h('h2', {}, 'Your data'),
      state.profile ? h('div', { class: 'muted' }, `Profile: ${state.profile.personal?.name} · updated ${new Date(state.profile.updated_at).toLocaleString()}`) : h('div', { class: 'muted' }, 'No resume on file.'),
      h('div', { class: 'row' }, reset, state.profile ? exportBtn : null)),
  ];
}

// ---------- boot + context-menu / shortcut hand-off ----------
async function handlePending() {
  const { pending } = await chrome.storage.session.get('pending');
  if (!pending || Date.now() - pending.at > 60000) return;
  await chrome.storage.session.remove('pending');
  if (!state.profile) { go('tailor'); toast('Upload your resume first — then I can tailor to that job.', true); return; }
  // Context-menu clicks grant activeTab, so these work without extra prompts.
  if (pending.action === 'tailor') { go('tailor'); captureJob(pending.selection).catch((e) => toast(e.message, true)); }
  if (pending.action === 'scan') go('scan');
  if (pending.action === 'pipeline') go('pipeline');
}

chrome.storage.onChanged.addListener((changes, area) => { if (area === 'session' && changes.pending?.newValue) handlePending(); });

(async function boot() {
  state.settings = await store.getSettings();
  state.profile = await store.getProfile();
  render();
  handlePending();
})();
