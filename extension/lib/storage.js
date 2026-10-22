// Thin wrapper over chrome.storage.local. Everything the user owns (resume,
// profile, applications) stays on-device unless they connect a Google Sheet.

const DEFAULT_SETTINGS = {
  apiKey: '',                 // user's own Anthropic key (BYOK). Never synced.
  model: 'claude-sonnet-5-5', // tailoring / generation
  fastModel: 'claude-haiku-5-5', // board-scan scoring
  liveResearch: false,        // let Claude use web search for comp + company intel
  sheetWebAppUrl: '',         // Apps Script web app URL (see apps-script/Code.gs)
  sheetToken: '',             // shared secret checked by the Apps Script
  headshotMode: 'direct_only',// 'always' | 'direct_only' | 'never'
  plan: 'scout',              // scout | pro | elite
  licenseKey: '',
  followUpHour: 9,
  minConfidence: 0.30,
};

export async function getSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...(settings || {}) };
}

export async function saveSettings(patch) {
  const next = { ...(await getSettings()), ...patch };
  await chrome.storage.local.set({ settings: next });
  return next;
}

// Master profile = parsed resume (resume-optimizer schema) + raw source text
// used by the Truth Lock to verify claims.
export async function getProfile() {
  const { profile } = await chrome.storage.local.get('profile');
  return profile || null;
}

export async function saveProfile(profile) {
  await chrome.storage.local.set({ profile: { ...profile, updated_at: new Date().toISOString() } });
}

export async function getHeadshot() {
  const { headshot } = await chrome.storage.local.get('headshot');
  return headshot || null; // { dataUrl (jpeg), w, h }
}

export async function saveHeadshot(h) {
  await chrome.storage.local.set({ headshot: h });
}

export async function getApplications() {
  const { applications } = await chrome.storage.local.get('applications');
  return applications || [];
}

export async function upsertApplication(app) {
  const apps = await getApplications();
  const i = apps.findIndex((a) => a.job_id === app.job_id);
  const merged = { ...(i >= 0 ? apps[i] : {}), ...app, updated_at: new Date().toISOString() };
  if (i >= 0) apps[i] = merged; else apps.unshift(merged);
  await chrome.storage.local.set({ applications: apps });
  return merged;
}

// Usage counters for plan limits, bucketed by day and month.
export async function bumpUsage(kind) {
  const { usage = {} } = await chrome.storage.local.get('usage');
  const day = new Date().toISOString().slice(0, 10);
  const month = day.slice(0, 7);
  const key = (p) => `${kind}:${p}`;
  usage[key(day)] = (usage[key(day)] || 0) + 1;
  usage[key(month)] = (usage[key(month)] || 0) + 1;
  await chrome.storage.local.set({ usage });
}

export async function getUsage(kind) {
  const { usage = {} } = await chrome.storage.local.get('usage');
  const day = new Date().toISOString().slice(0, 10);
  return { today: usage[`${kind}:${day}`] || 0, month: usage[`${kind}:${day.slice(0, 7)}`] || 0 };
}

export function newJobId() {
  const d = new Date();
  const stamp = d.toISOString().slice(0, 10).replace(/-/g, '');
  return `JH-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
