// Tiered confidence plans. Each tier unlocks a higher interview-likelihood band
// and deeper analysis (full-JD fetch + live research make estimates more
// reliable). Matches above the user's unlocked band are shown as locked
// teasers, which is the upgrade hook.
//
// NOTE: in BYOK mode these limits are enforced client-side only. For real
// billing, move scoring + generation behind a backend that checks the license
// (see docs/PRICING.md).

export const PLANS = {
  scout: {
    name: 'Scout',
    price: 0,
    unlockedFloor: 0.30, // sees matches 30%+
    unlockedCeiling: 0.50, // 50%+ shown locked
    scansPerDay: 3,
    cardsPerScan: 25,
    deepScan: 0,          // jobs per scan whose full JD is fetched before scoring
    packagesPerMonth: 5,
    liveResearch: false,
    interviewPrep: false,
  },
  pro: {
    name: 'Pro',
    price: 19,
    unlockedFloor: 0.30,
    unlockedCeiling: 0.75,
    scansPerDay: 25,
    cardsPerScan: 60,
    deepScan: 10,
    packagesPerMonth: 60,
    liveResearch: true,
    interviewPrep: true,
  },
  elite: {
    name: 'Elite',
    price: 49,
    unlockedFloor: 0.30,
    unlockedCeiling: 1.01,
    scansPerDay: 200,
    cardsPerScan: 120,
    deepScan: 40,
    packagesPerMonth: 400,
    liveResearch: true,
    interviewPrep: true,
  },
};

export const BANDS = [
  { min: 0.75, label: '75%+ Strong', plan: 'elite', cls: 'band-strong' },
  { min: 0.50, label: '50–74% Likely', plan: 'pro', cls: 'band-likely' },
  { min: 0.30, label: '30–49% Possible', plan: 'scout', cls: 'band-possible' },
];

export function planFor(settings) {
  return PLANS[settings.plan] || PLANS.scout;
}

export function isUnlocked(prob, plan) {
  return prob < plan.unlockedCeiling;
}

export function bandFor(prob) {
  return BANDS.find((b) => prob >= b.min) || null;
}

// Hook for a real license server. Returns the plan id the key entitles.
export async function verifyLicense(licenseKey, endpoint) {
  if (!licenseKey) return 'scout';
  if (!endpoint) return null; // unknown, keep current
  try {
    const r = await fetch(endpoint, { method: 'POST', body: JSON.stringify({ licenseKey }) });
    const j = await r.json();
    return PLANS[j.plan] ? j.plan : 'scout';
  } catch {
    return null;
  }
}
