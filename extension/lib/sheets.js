// Talks to the Apps Script web app bound to the user's tracker sheet
// (apps-script/Code.gs). The script stores PDFs in Drive, returns share
// links, appends Tracker rows, and sends follow-up reminder emails.

async function post(settings, payload) {
  if (!settings.sheetWebAppUrl) throw new Error('Connect your Google Sheet in Settings first.');
  // text/plain avoids a CORS preflight, which Apps Script can't answer.
  const res = await fetch(settings.sheetWebAppUrl, {
    method: 'POST',
    headers: { 'content-type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ token: settings.sheetToken, ...payload }),
  });
  const json = await res.json().catch(() => null);
  if (!json) throw new Error(`Sheet sync failed (HTTP ${res.status}). Check the web app URL and that it's deployed for "Anyone".`);
  if (!json.ok) throw new Error(json.error || 'Sheet sync failed.');
  return json;
}

export const pingSheet = (settings) => post(settings, { action: 'ping' });

// files: [{ kind: 'resume'|'cover', name, mime, base64 }]
export const logApplication = (settings, record, files = []) => post(settings, { action: 'logApplication', record, files });

export const updateApplication = (settings, job_id, patch) => post(settings, { action: 'updateApplication', job_id, patch });

export const logScan = (settings, rows) => post(settings, { action: 'logScan', rows });

// Maps an in-extension application onto the Tracker's column names
// (Job Hunter Pro v3 schema). Unknown columns are left blank by the script.
export function trackerRecord(app) {
  const pkg = app.pkg || {};
  const job = pkg.job || {};
  const comp = pkg.compensation || {};
  const today = new Date().toLocaleDateString('en-US');
  return {
    job_id: app.job_id,
    date_added: today,
    source_type: 'chrome_extension',
    source_url: app.source_url,
    company: job.company,
    title: job.title,
    location: job.location,
    work_mode: job.work_mode,
    current_status: app.status || 'package generated',
    priority_score: app.likelihood ? Math.round(app.likelihood * 100) : '',
    direct_apply_url: app.apply_url,
    easy_apply_flag: app.easy_apply ? 'yes' : 'no',
    application_date: app.applied_at ? new Date(app.applied_at).toLocaleDateString('en-US') : '',
    comp_base_low: comp.base_low || '',
    comp_base_high: comp.base_high || '',
    comp_total_low: comp.total_low || '',
    comp_total_high: comp.total_high || '',
    comp_confidence: comp.confidence || '',
    knowledge_gap_summary: (pkg.ats?.unsupported || []).slice(0, 8).join(', '),
    next_follow_up_date: app.next_follow_up ? new Date(app.next_follow_up).toLocaleDateString('en-US') : '',
    follow_up_stage: app.follow_up_stage || 'none',
    response_received: app.response_received ? 'yes' : 'no',
    last_contact_date: app.last_contact_date ? new Date(app.last_contact_date).toLocaleDateString('en-US') : '',
    notes: `ATS ${pkg.ats?.before ?? '?'}% -> ${pkg.ats?.after ?? '?'}% | ${pkg.job?.ats_platform || ''}`,
    created_at: today,
    updated_at: today,
    package_generated_date: today,
    jd_text: (app.jd_text || '').slice(0, 45000),
    tailoring_notes: (pkg.changes_log || []).map((c) => `${c.section}: ${c.change}`).join(' | ').slice(0, 2000),
  };
}
