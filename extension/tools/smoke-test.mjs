// Offline checks for the pure modules: scoring, Truth Lock, PDF rendering.
// Run: node tools/smoke-test.mjs   (writes sample PDFs to tools/out/)
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { likelihood, parseSignals, prefilterScore } from '../lib/scoring.js';
import { buildResumeModel, unverifiedMetrics } from '../lib/truth.js';
import { renderResumePDF, renderCoverLetterPDF, plainTextResume, SCHEMES } from '../lib/render.js';
import { PLANS, isUnlocked, bandFor } from '../lib/plans.js';

globalThis.atob ??= (b) => Buffer.from(b, 'base64').toString('binary');

const profile = JSON.parse(readFileSync(new URL('../../examples/master-profile.example.json', import.meta.url), 'utf8').replace(/^﻿/, '')) ;
// Normalize the repo example into the extension's profile shape if needed.
const p = profile.experience ? profile : {
  personal: { name: 'Mark Bockrath', email: 'bockrath.ai@gmail.com', phone: '302-519-2960', location: 'Greater Philadelphia', linkedin: 'https://www.linkedin.com/in/mark-b-a5a1b2196/' },
  experience: [
    { title: 'Director, Mid-Enterprise Sales', company: 'Example Co', dates: '2021 – Present', location: 'Remote', bullets: ['Grew ARR from $4M to $11M in 30 months'] },
    { title: 'Regional Sales Manager', company: 'Prior Co', dates: '2016 – 2021', location: 'Philadelphia, PA', bullets: ['Led a team of 12 AEs'] },
  ],
  education: [{ degree: 'B.S. Business Administration', institution: 'University of Delaware', year: '2008' }],
  skills: { certifications: [] },
};
p.source_text ??= JSON.stringify(p);

// --- scoring ---
const strong = likelihood({ must_have_coverage: 0.9, title_adjacency: 0.9, domain_fit: 0.9, seniority_gap: 0, location_fit: 1 });
const weak = likelihood({ must_have_coverage: 0.3, title_adjacency: 0.2, domain_fit: 0.3, seniority_gap: -2, location_fit: 0 });
assert(strong >= 0.75 && strong <= 0.92, `strong=${strong}`);
assert(weak < 0.1, `weak=${weak}`);
const crowded = likelihood({ must_have_coverage: 0.9, title_adjacency: 0.9, domain_fit: 0.9, seniority_gap: 0, location_fit: 1 }, { applicants: 600, easyApply: true, postedDaysAgo: 45 });
assert(crowded < strong, 'competition + staleness lower the estimate');
assert.deepEqual(parseSignals('Over 200 applicants · 3 weeks ago · Easy Apply'), { applicants: 200, postedDaysAgo: 21, easyApply: true });
assert(prefilterScore({ title: p.experience[0].title, snippet: '' }, p) > 0.5);
assert.equal(bandFor(0.8).plan, 'elite');
assert.equal(isUnlocked(0.8, PLANS.pro), false);
assert.equal(isUnlocked(0.8, PLANS.elite), true);

// --- truth lock ---
assert.deepEqual(unverifiedMetrics('Grew ARR to $11M and cut churn 40%', 'grew arr from $4m to $11m'), ['40%']);
const pkg = {
  job: { title: 'VP, Enterprise Sales', company: 'Acme AI', application_method: 'ats_portal' },
  resume: {
    headline: 'Enterprise Sales Leader | AI-Native GTM',
    summary: 'Enterprise sales leader with 15+ years building and scaling teams.',
    core_competencies: ['Enterprise SaaS', 'Pipeline Strategy', 'AI Sales Automation', 'Forecasting'],
    experience: [{ index: 0, bullets: ['Scaled ARR from $4M to $11M in 30 months', 'Boosted win rate 300% via AI'] }],
  },
  cover_letter: { paragraphs: ['Acme just launched its agent platform.', 'At Example Co I scaled ARR from $4M to $11M.', 'You need repeatable enterprise motion.', 'I would welcome 20 minutes.'], closing: 'Sincerely,' },
};
// The model tried to rename the employer — Truth Lock must ignore that.
pkg.resume.experience[0].company = 'Fake Inc';
const model = buildResumeModel(p, pkg);
assert.equal(model.experience[0].company, p.experience[0].company);
assert.equal(model.experience[0].dates, p.experience[0].dates);
assert(model.flags.some((f) => f.metrics.includes('300%')), 'unverified 300% is flagged');

// --- rendering ---
const out = new URL('./out/', import.meta.url);
mkdirSync(out, { recursive: true });
const resume = renderResumePDF(model, { scheme: SCHEMES.executive_red });
const cover = renderCoverLetterPDF(model, pkg, { scheme: SCHEMES.executive_red });
for (const [name, bytes] of [['sample_resume.pdf', resume], ['sample_cover.pdf', cover]]) {
  const head = Buffer.from(bytes.slice(0, 8)).toString('latin1');
  assert(head.startsWith('%PDF-1.4'), name);
  assert(Buffer.from(bytes.slice(-6)).toString('latin1').includes('%%EOF'), name);
  writeFileSync(new URL(name, out), bytes);
}
writeFileSync(new URL('sample_resume.txt', out), plainTextResume(model));
console.log('smoke test passed', { strong: strong.toFixed(2), crowded: crowded.toFixed(2), weak: weak.toFixed(3), flags: model.flags.length });
