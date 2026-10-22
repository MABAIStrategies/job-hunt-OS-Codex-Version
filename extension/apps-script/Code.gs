/**
 * Job Hunt OS — Google Sheet backend for the Chrome extension.
 *
 * Install (2 minutes):
 *  1. Open your tracker sheet → Extensions → Apps Script. Paste this file.
 *  2. Run `setupWorkbook` once (authorize). It builds/repairs the tabs, makes a
 *     Drive folder, creates a token, and schedules the daily follow-up digest.
 *  3. Deploy → New deployment → Web app. Execute as: Me. Who has access: Anyone.
 *  4. Paste the web app URL and the token (Job Hunt OS menu → Show token)
 *     into the extension's Settings.
 *
 * The web app only accepts requests that carry your token.
 */

const TABS = {
  Tracker: ['job_id', 'date_added', 'source_type', 'source_url', 'company', 'title', 'location', 'work_mode', 'current_status', 'priority_score',
    'direct_apply_url', 'easy_apply_flag', 'application_date', 'resume_pdf_link', 'cover_letter_pdf_link', 'comp_base_low', 'comp_base_high',
    'comp_bonus_low', 'comp_bonus_high', 'comp_lti_low', 'comp_lti_high', 'comp_total_low', 'comp_total_high', 'comp_confidence', 'mock_score',
    'knowledge_gap_summary', 'recruiter_name', 'recruiter_contact', 'recruiter_last_message_date', 'hiring_manager_name', 'hiring_manager_contact',
    'hiring_manager_last_message_date', 'peer_targets', 'peer_last_message_date', 'response_received', 'response_summary', 'last_contact_date',
    'next_follow_up_date', 'follow_up_stage', 'days_open', 'days_since_application', 'notes', 'created_at', 'updated_at', 'package_generated_date',
    'jd_text', 'role_family', 'positioning_mode', 'seniority_mode', 'ai_relevance', 'mab_mode', 'headline_override', 'summary_override',
    'core_competencies_override', 'top_experience_focus', 'cover_letter_angle', 'suppress_ai_heavy_language', 'brief_drive_link',
    'brief_generated_at', 'tailoring_resolved_at', 'tailoring_notes'],
  'Scan Results': ['scanned_at', 'title', 'company', 'location', 'url', 'interview_likelihood', 'band', 'reason', 'source_page', 'status'],
  'Follow-Ups': ['job_id', 'company', 'title', 'stage', 'due_date', 'status', 'notified_at'],
  'Outreach Queue': ['job_id', 'company', 'title', 'contact_type', 'contact_name', 'draft', 'status', 'sent_at'],
  'Nightly Digest': ['date', 'open_roles', 'applied', 'interviewing', 'follow_ups_due', 'new_scan_matches', 'summary'],
  Contacts: ['name', 'company', 'role', 'email', 'linkedin', 'relationship', 'last_contact', 'notes'],
  Settings: ['setting_key', 'setting_value'],
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Job Hunt OS')
    .addItem('Set up / repair workbook', 'setupWorkbook')
    .addItem('Show extension token', 'showToken')
    .addItem('Run follow-up digest now', 'dailyDigest')
    .addToUi();
}

function setupWorkbook() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(TABS).forEach((name) => {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    const want = TABS[name];
    const lastCol = Math.max(1, sh.getLastColumn());
    const have = sh.getRange(1, 1, 1, lastCol).getValues()[0].filter(String);
    const missing = want.filter((h) => have.indexOf(h) < 0);
    if (missing.length) sh.getRange(1, have.length + 1, 1, missing.length).setValues([missing]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold').setBackground('#1F3A5F').setFontColor('#FFFFFF');
  });
  buildDashboard_(ss);
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty('JHOS_TOKEN')) props.setProperty('JHOS_TOKEN', Utilities.getUuid().replace(/-/g, ''));
  folder_();
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'dailyDigest').forEach((t) => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('dailyDigest').timeBased().everyDays(1).atHour(8).create();
  showToken();
}

function showToken() {
  const t = PropertiesService.getScriptProperties().getProperty('JHOS_TOKEN');
  SpreadsheetApp.getUi().alert('Paste this token into Job Hunt OS → Settings → Google Sheet tracker:\n\n' + t);
}

function buildDashboard_(ss) {
  const sh = ss.getSheetByName('Dashboard') || ss.insertSheet('Dashboard', 0);
  sh.clear();
  const rows = [
    ['Job Hunt OS — Pipeline Dashboard', ''],
    ['Total opportunities', '=COUNTA(Tracker!A2:A)'],
    ['Packages generated', '=COUNTIF(Tracker!I2:I,"package generated")'],
    ['Applied', '=COUNTIF(Tracker!I2:I,"applied")'],
    ['Interviewing', '=COUNTIF(Tracker!I2:I,"interviewing")'],
    ['Offers', '=COUNTIF(Tracker!I2:I,"offer")'],
    ['Follow-ups due today or overdue', '=COUNTIFS(Tracker!AL2:AL,"<="&TODAY(),Tracker!AL2:AL,"<>",Tracker!AI2:AI,"<>yes")'],
    ['Avg interview likelihood (%)', '=IFERROR(ROUND(AVERAGE(Tracker!J2:J),0),"")'],
    ['Response rate', '=IFERROR(COUNTIF(Tracker!AI2:AI,"yes")/COUNTIF(Tracker!I2:I,"<>package generated"),"")'],
    ['Strong matches found (75%+)', "=COUNTIF('Scan Results'!F2:F,\">=75\")"],
    ['Likely matches found (50–74%)', "=COUNTIFS('Scan Results'!F2:F,\">=50\",'Scan Results'!F2:F,\"<75\")"],
  ];
  sh.getRange(1, 1, rows.length, 2).setValues(rows);
  sh.getRange('A1').setFontSize(16).setFontWeight('bold').setFontColor('#1F3A5F');
  sh.getRange('A2:A' + rows.length).setFontWeight('bold');
  sh.getRange('B9').setNumberFormat('0%');
  sh.setColumnWidth(1, 300);
}

function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty('JHOS_FOLDER');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* recreate */ } }
  const f = DriveApp.createFolder('Job Hunt OS — Application Documents');
  props.setProperty('JHOS_FOLDER', f.getId());
  return f;
}

// ---------------- web app ----------------

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    const token = PropertiesService.getScriptProperties().getProperty('JHOS_TOKEN');
    if (!token || req.token !== token) return json_({ ok: false, error: 'Invalid token. Copy it from Job Hunt OS → Show extension token.' });
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      if (req.action === 'ping') return json_({ ok: true, sheet: SpreadsheetApp.getActive().getName() });
      if (req.action === 'logApplication') return json_(logApplication_(req.record, req.files || []));
      if (req.action === 'updateApplication') return json_(updateApplication_(req.job_id, req.patch || {}));
      if (req.action === 'logScan') return json_(appendRows_('Scan Results', req.rows || []));
      return json_({ ok: false, error: 'Unknown action' });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function logApplication_(record, files) {
  const links = {};
  if (files.length) {
    const root = folder_();
    const name = [record.company, record.title, record.job_id].filter(String).join(' — ').slice(0, 120);
    const it = root.getFoldersByName(name);
    const dir = it.hasNext() ? it.next() : root.createFolder(name);
    files.forEach((f) => {
      const blob = Utilities.newBlob(Utilities.base64Decode(f.base64), f.mime, f.name);
      const old = dir.getFilesByName(f.name);
      while (old.hasNext()) old.next().setTrashed(true);
      const file = dir.createFile(blob);
      // Recruiters must be able to open the link without a Google login.
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      links[f.kind] = file.getUrl();
    });
  }
  if (links.resume) record.resume_pdf_link = links.resume;
  if (links.cover) record.cover_letter_pdf_link = links.cover;
  const row = upsert_('Tracker', 'job_id', record);
  return { ok: true, row: row, links: links };
}

function updateApplication_(jobId, patch) {
  patch.job_id = jobId;
  patch.updated_at = new Date().toLocaleDateString('en-US');
  if (patch.follow_up_stage && patch.follow_up_stage !== 'none' && patch.next_follow_up_date) {
    appendRows_('Follow-Ups', [{ job_id: jobId, company: patch.company, title: patch.title, stage: patch.follow_up_stage, due_date: patch.next_follow_up_date, status: 'open' }]);
  }
  return { ok: true, row: upsert_('Tracker', 'job_id', patch) };
}

function headers_(sh) {
  return sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
}

function upsert_(tab, keyCol, record) {
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  const hdr = headers_(sh);
  const keyIdx = hdr.indexOf(keyCol);
  const last = sh.getLastRow();
  let rowNum = -1;
  if (last > 1 && keyIdx >= 0) {
    const keys = sh.getRange(2, keyIdx + 1, last - 1, 1).getValues();
    for (let i = 0; i < keys.length; i++) if (String(keys[i][0]) === String(record[keyCol])) { rowNum = i + 2; break; }
  }
  if (rowNum < 0) {
    sh.appendRow(hdr.map((h) => (record[h] !== undefined ? record[h] : '')));
    return sh.getLastRow();
  }
  const range = sh.getRange(rowNum, 1, 1, hdr.length);
  const cur = range.getValues()[0];
  // Only overwrite fields the extension sent with a value; keep manual edits.
  range.setValues([hdr.map((h, i) => (record[h] !== undefined && record[h] !== '' ? record[h] : cur[i]))]);
  return rowNum;
}

function appendRows_(tab, rows) {
  if (!rows.length) return { ok: true, added: 0 };
  const sh = SpreadsheetApp.getActive().getSheetByName(tab);
  const hdr = headers_(sh);
  const values = rows.map((r) => hdr.map((h) => (r[h] !== undefined ? r[h] : '')));
  sh.getRange(sh.getLastRow() + 1, 1, values.length, hdr.length).setValues(values);
  return { ok: true, added: values.length };
}

// ---------------- notifications ----------------

function dailyDigest() {
  const ss = SpreadsheetApp.getActive();
  const sh = ss.getSheetByName('Tracker');
  const data = sh.getDataRange().getValues();
  const hdr = data.shift();
  const col = (n) => hdr.indexOf(n);
  const today = new Date(); today.setHours(23, 59, 59, 0);
  const due = data.filter((r) => {
    const d = r[col('next_follow_up_date')];
    return d && new Date(d) <= today && String(r[col('response_received')]).toLowerCase() !== 'yes'
      && ['closed', 'rejected', 'offer'].indexOf(String(r[col('current_status')])) < 0;
  });
  const count = (s) => data.filter((r) => r[col('current_status')] === s).length;
  const scans = ss.getSheetByName('Scan Results').getDataRange().getValues().slice(1)
    .filter((r) => r[0] && (new Date() - new Date(r[0])) < 86400000 && Number(r[5]) >= 50).length;
  const summary = due.map((r) => '• ' + r[col('company')] + ' — ' + r[col('title')] + ' (' + r[col('follow_up_stage')] + ')').join('\n');
  ss.getSheetByName('Nightly Digest').appendRow([new Date(), data.length, count('applied'), count('interviewing'), due.length, scans, summary]);
  if (due.length || scans) {
    MailApp.sendEmail(Session.getEffectiveUser().getEmail(), 'Job Hunt OS: ' + due.length + ' follow-ups due, ' + scans + ' new 50%+ matches',
      'Follow-ups due today:\n' + (summary || 'none') + '\n\nNew 50%+ matches from scans in the last 24h: ' + scans + '\n\nOpen your tracker: ' + ss.getUrl());
  }
}
