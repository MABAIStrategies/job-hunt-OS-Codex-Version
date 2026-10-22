// Resume + cover letter layouts on top of PDFDoc. Single-column, ATS-safe
// structure with a colored accent (schemes from the resume-optimizer skill).

import { PDFDoc, dataUrlToBytes } from './pdf.js';

export const SCHEMES = {
  tech_navy:       { primary: '#1F3A5F', accent: '#3B82F6' },
  finance_gold:    { primary: '#1C2B39', accent: '#B8892B' },
  healthcare_teal: { primary: '#0F4C5C', accent: '#14B8A6' },
  government_navy: { primary: '#14213D', accent: '#4A6FA5' },
  executive_red:   { primary: '#2B2D42', accent: '#C1121F' },
  creative_purple: { primary: '#3C1A5B', accent: '#8B5CF6' },
};

const M = 50; // margin
const INK = '#1F2328', MUTED = '#57606A';

function contactLine(p) {
  return [p.location, p.phone, p.email, p.linkedin?.replace(/^https?:\/\/(www\.)?/, ''), p.website?.replace(/^https?:\/\//, '')].filter(Boolean).join('  |  ');
}

function layout(doc) {
  let y = M;
  const maxW = doc.W - 2 * M;
  const api = {
    get y() { return y; }, set y(v) { y = v; }, maxW,
    ensure(h) { if (y + h > doc.H - M) { doc.addPage(); y = M; } },
    para(text, { size = 10, font = 'regular', color = INK, indent = 0, lead = 1.35, width } = {}) {
      for (const line of doc.wrap(text, (width || maxW) - indent, size, font)) {
        api.ensure(size * lead);
        doc.text(line, M + indent, y + size, { size, font, color });
        y += size * lead;
      }
    },
    bullet(text, scheme) {
      const size = 9.8, lead = 1.33, ind = 12;
      const lines = doc.wrap(text, maxW - ind, size);
      api.ensure(size * lead * Math.min(lines.length, 2));
      doc.text('•', M + 2, y + size, { size, color: scheme.accent, font: 'bold' });
      for (const line of lines) { api.ensure(size * lead); doc.text(line, M + ind, y + size, { size, color: INK }); y += size * lead; }
      y += 1.5;
    },
    section(title, scheme) {
      api.ensure(34);
      y += 8;
      doc.text(title.toUpperCase(), M, y + 10, { size: 10.5, font: 'bold', color: scheme.primary });
      y += 15;
      doc.line(M, y, doc.W - M, y, scheme.accent, 1);
      y += 7;
    },
  };
  return api;
}

export function renderResumePDF(model, { scheme = SCHEMES.tech_navy, headshot = null } = {}) {
  const doc = new PDFDoc();
  const L = layout(doc);
  const p = model.personal;
  const photo = headshot?.dataUrl ? 66 : 0;
  const textW = L.maxW - (photo ? photo + 16 : 0);

  doc.rect(0, 0, doc.W, 6, scheme.accent);
  L.y = M - 8;
  if (photo) doc.image(dataUrlToBytes(headshot.dataUrl), headshot.w, headshot.h, doc.W - M - photo, M - 12, photo, photo, { circle: true });
  L.para(p.name || '', { size: 24, font: 'bold', color: scheme.primary, width: textW, lead: 1.15 });
  if (model.headline) L.para(model.headline, { size: 11.5, font: 'bold', color: scheme.accent, width: textW });
  L.para(contactLine(p), { size: 8.8, color: MUTED, width: textW });
  if (photo) L.y = Math.max(L.y, M - 12 + photo + 4);

  if (model.summary) { L.section('Professional Summary', scheme); L.para(model.summary, { size: 10 }); }

  if (model.competencies.length) {
    L.section('Core Competencies', scheme);
    L.para(model.competencies.join('  •  '), { size: 9.6, color: INK });
  }

  L.section('Professional Experience', scheme);
  model.experience.forEach((e, i) => {
    L.ensure(48);
    if (i) L.y += 5;
    const dates = e.dates || '';
    const dW = doc.widthOf(dates, 9.5, 'bold');
    const head = doc.wrap(e.title, L.maxW - dW - 12, 10.8, 'bold');
    doc.text(dates, doc.W - M - dW, L.y + 10.8, { size: 9.5, font: 'bold', color: MUTED });
    head.forEach((h) => { doc.text(h, M, L.y + 10.8, { size: 10.8, font: 'bold', color: INK }); L.y += 14; });
    L.para([e.company, e.location].filter(Boolean).join('  —  '), { size: 9.8, font: 'italic', color: scheme.primary });
    L.y += 2;
    e.bullets.forEach((b) => L.bullet(b, scheme));
  });

  const skillRows = [['Technical', model.skills.technical], ['Tools & Platforms', model.skills.tools], ['Certifications', model.skills.certifications]].filter(([, v]) => v?.length);
  if (skillRows.length) {
    L.section('Skills', scheme);
    skillRows.forEach(([label, vals]) => L.para(`${label}: ${vals.join(', ')}`, { size: 9.6 }));
  }

  if (model.education.length) {
    L.section('Education', scheme);
    model.education.forEach((ed) => {
      L.para([ed.degree, ed.institution, ed.year].filter(Boolean).join('  —  '), { size: 10, font: 'bold' });
      if (ed.honors) L.para(ed.honors, { size: 9.4, color: MUTED });
    });
  }
  return doc.toBytes({ title: `${p.name} — Resume`, author: p.name });
}

export function renderCoverLetterPDF(model, pkg, { scheme = SCHEMES.tech_navy } = {}) {
  const doc = new PDFDoc();
  const L = layout(doc);
  const p = model.personal;
  doc.rect(0, 0, doc.W, 6, scheme.accent);
  L.y = M - 8;
  L.para(p.name || '', { size: 20, font: 'bold', color: scheme.primary, lead: 1.2 });
  L.para(contactLine(p), { size: 8.8, color: MUTED });
  L.y += 6;
  doc.line(M, L.y, doc.W - M, L.y, scheme.accent, 1);
  L.y += 22;
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  L.para(date, { size: 10.5, color: MUTED });
  L.y += 8;
  const job = pkg.job || {};
  L.para(`Hiring Team, ${job.company || ''}`.trim().replace(/,$/, ''), { size: 10.5, font: 'bold' });
  L.para(`Re: ${job.title || 'Open role'}`, { size: 10.5, color: MUTED });
  L.y += 12;
  L.para('Dear Hiring Team,', { size: 10.8 });
  L.y += 6;
  (pkg.cover_letter?.paragraphs || []).forEach((para) => { L.para(para, { size: 10.8, lead: 1.45 }); L.y += 9; });
  L.y += 4;
  L.para(pkg.cover_letter?.closing || 'Sincerely,', { size: 10.8 });
  L.y += 4;
  L.para(p.name || '', { size: 11.5, font: 'bold', color: scheme.primary });
  return doc.toBytes({ title: `${p.name} — Cover Letter`, author: p.name });
}

export function plainTextResume(model) {
  const p = model.personal;
  const rule = '-'.repeat(60);
  const out = [p.name?.toUpperCase(), contactLine(p), '', model.headline, '', 'PROFESSIONAL SUMMARY', rule, model.summary, ''];
  if (model.competencies.length) out.push('CORE COMPETENCIES', rule, model.competencies.join(' | '), '');
  out.push('PROFESSIONAL EXPERIENCE', rule);
  model.experience.forEach((e) => {
    out.push(`${e.title} - ${e.company}  (${e.dates})`);
    if (e.location) out.push(e.location);
    e.bullets.forEach((b) => out.push(`- ${b}`));
    out.push('');
  });
  const s = model.skills;
  out.push('SKILLS', rule, [...s.technical, ...s.tools].join(', '));
  if (s.certifications.length) out.push(`Certifications: ${s.certifications.join(', ')}`);
  out.push('', 'EDUCATION', rule);
  model.education.forEach((ed) => out.push([ed.degree, ed.institution, ed.year].filter(Boolean).join(' - ')));
  return out.filter((l) => l !== undefined).join('\n');
}

export function fileBase(personal, job) {
  const safe = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 40);
  const [first, ...rest] = (personal.name || 'Candidate').split(' ');
  return [safe(first), safe(rest.pop() || ''), safe(job.title), safe(job.company)].filter(Boolean).join('_');
}
