// Interview-likelihood model. Claude scores fit *features*; this file turns
// them into a probability with a fixed, explainable formula so the same job
// always gets the same number and users can see why.

const W = { bias: -4.2, coverage: 3.0, title: 1.8, domain: 1.2, seniority: -0.9, location: 0.8, competition: -0.6, stale: -0.5 };
const CAP = 0.92; // never claim near-certainty

const sigmoid = (z) => 1 / (1 + Math.exp(-z));
const clamp01 = (x) => Math.max(0, Math.min(1, Number(x) || 0));

export function likelihood(f, signals = {}) {
  const z =
    W.bias +
    W.coverage * clamp01(f.must_have_coverage) +
    W.title * clamp01(f.title_adjacency) +
    W.domain * clamp01(f.domain_fit) +
    W.seniority * Math.abs(Number(f.seniority_gap) || 0) +
    W.location * (f.location_fit ? 1 : 0) +
    W.competition * competition(signals) +
    W.stale * (staleDays(signals) > 30 ? 1 : 0);
  return Math.min(CAP, sigmoid(z));
}

// 0..1 proxy for applicant volume: visible applicant counts and Easy Apply.
export function competition({ applicants, easyApply } = {}) {
  let c = 0.3;
  if (typeof applicants === 'number') c = Math.min(1, applicants / 300);
  if (easyApply) c = Math.min(1, c + 0.25);
  return c;
}

export function staleDays({ postedDaysAgo } = {}) {
  return typeof postedDaysAgo === 'number' ? postedDaysAgo : 0;
}

export function explain(f, signals) {
  const out = [];
  if (clamp01(f.must_have_coverage) >= 0.75) out.push('Covers most must-haves');
  else if (clamp01(f.must_have_coverage) < 0.45) out.push('Missing key requirements');
  if (Math.abs(f.seniority_gap) >= 1) out.push(f.seniority_gap < 0 ? 'Role is above your level' : 'Role may be below your level');
  if (!f.location_fit) out.push('Location mismatch');
  if (competition(signals) > 0.6) out.push('High applicant volume');
  if (staleDays(signals) > 30) out.push(`Posted ${staleDays(signals)}d ago — may be stale`);
  return out;
}

// --- Local prefilter: rank cards cheaply before spending tokens ---

const STOP = new Set('and or the a an of to in for with on at by from as is are be we you our your this that will'.split(' '));
const tokens = (s) => (s || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t));

export function prefilterScore(card, profile) {
  const bank = new Set((profile.keywords_bank || []).flatMap(tokens));
  const titleBank = new Set([...(profile.target_titles || []), ...(profile.experience || []).map((e) => e.title)].flatMap(tokens));
  const cardTitle = tokens(card.title);
  const cardText = tokens(`${card.title} ${card.snippet || ''}`);
  const titleHit = cardTitle.filter((t) => titleBank.has(t)).length / Math.max(1, cardTitle.length);
  const kwHit = cardText.filter((t) => bank.has(t)).length / Math.max(1, Math.min(cardText.length, 25));
  return 0.65 * titleHit + 0.35 * Math.min(1, kwHit);
}

// Parse "Over 200 applicants", "3 days ago", "30+ days ago" etc. from card text.
export function parseSignals(text = '') {
  const t = text.toLowerCase();
  const s = {};
  const ap = t.match(/(?:over\s+)?(\d[\d,]*)\+?\s+applicants?/);
  if (ap) s.applicants = Number(ap[1].replace(/,/g, ''));
  const d = t.match(/(\d+)\+?\s+(day|week|month)s?\s+ago/);
  if (d) s.postedDaysAgo = Number(d[1]) * (d[2] === 'week' ? 7 : d[2] === 'month' ? 30 : 1);
  if (/just posted|today|hours? ago|minutes? ago/.test(t)) s.postedDaysAgo = 0;
  if (/easy apply|quick apply|1-click apply/.test(t)) s.easyApply = true;
  return s;
}
