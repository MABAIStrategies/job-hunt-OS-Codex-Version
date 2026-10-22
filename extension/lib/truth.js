// Truth Lock: employer, title, dates, chronology and education always come
// from the master profile — never from the model. Any metric the model writes
// that doesn't appear in the source resume is flagged for review.

const NUM_RE = /\$?\d[\d,.]*\s?(?:%|[kKmMbB]\b|\+|x\b|million|billion)?/g;
const norm = (s) => String(s).toLowerCase().replace(/[\s,]/g, '').replace(/\.0+(?=\D|$)/, '');

export function unverifiedMetrics(text, sourceText) {
  const src = norm(sourceText || '');
  const found = (String(text).match(NUM_RE) || []).map((m) => m.trim()).filter((m) => /\d/.test(m));
  return [...new Set(found.filter((m) => {
    const core = norm(m).replace(/^\$/, '').replace(/(million|billion)$/, '');
    if (/^(19|20)\d\d$/.test(core)) return false; // years
    if (core.length <= 1) return false;
    return !src.includes(core);
  }))];
}

export function buildResumeModel(profile, pkg) {
  const r = pkg.resume || {};
  const byIndex = new Map((r.experience || []).map((e) => [Number(e.index), e.bullets || []]));
  const source = profile.source_text || JSON.stringify(profile);
  const flags = [];

  const experience = (profile.experience || []).map((e, i) => {
    const bullets = (byIndex.get(i) || e.bullets || []).filter(Boolean);
    bullets.forEach((b) => {
      const bad = unverifiedMetrics(b, source);
      if (bad.length) flags.push({ where: `${e.company} bullet`, text: b, metrics: bad });
    });
    // Locked fields copied verbatim from the profile.
    return { title: e.title, company: e.company, dates: e.dates, location: e.location, bullets };
  });

  const summaryBad = unverifiedMetrics(r.summary || '', source);
  if (summaryBad.length) flags.push({ where: 'Summary', text: r.summary, metrics: summaryBad });

  return {
    personal: profile.personal || {},
    headline: r.headline || profile.personal?.tagline || '',
    summary: r.summary || profile.summary || '',
    competencies: r.core_competencies || [],
    skills: {
      technical: r.skills?.technical || profile.skills?.technical || [],
      tools: r.skills?.tools || profile.skills?.tools || [],
      // Certifications may only come from the profile.
      certifications: (profile.skills?.certifications || []),
    },
    experience,
    education: profile.education || [],
    flags,
  };
}
