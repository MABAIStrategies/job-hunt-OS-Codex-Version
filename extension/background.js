// Service worker: opens the side panel, wires the context menu + shortcut,
// and runs the daily follow-up reminder check.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'jhos-tailor-selection', title: 'Tailor my resume to this job description', contexts: ['selection'] });
  chrome.contextMenus.create({ id: 'jhos-tailor-page', title: 'Tailor my resume to this job page', contexts: ['page'] });
  chrome.contextMenus.create({ id: 'jhos-scan-page', title: 'Find jobs I can land on this page', contexts: ['page'] });
  scheduleDaily();
});
chrome.runtime.onStartup.addListener(scheduleDaily);

// The side panel picks up `pending` from session storage and runs it.
// sidePanel.open must run synchronously inside the user gesture, so open first.
function queue(tab, action, extra = {}) {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {});
  chrome.storage.session.set({ pending: { action, tabId: tab.id, at: Date.now(), ...extra } });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'jhos-tailor-selection') queue(tab, 'tailor', { selection: info.selectionText });
  if (info.menuItemId === 'jhos-tailor-page') queue(tab, 'tailor');
  if (info.menuItemId === 'jhos-scan-page') queue(tab, 'scan');
});

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd === 'tailor-current-page' && tab) queue(tab, 'tailor');
});

// --- Follow-up reminders (T0 recruiter, T+1 hiring manager, T+3 peer) ---

async function scheduleDaily() {
  const { settings = {} } = await chrome.storage.local.get('settings');
  const hour = settings.followUpHour ?? 9;
  const next = new Date();
  next.setHours(hour, 0, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  chrome.alarms.create('jhos-daily', { when: next.getTime(), periodInMinutes: 24 * 60 });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name !== 'jhos-daily') return;
  const { applications = [] } = await chrome.storage.local.get('applications');
  const now = Date.now();
  const due = applications.filter((a) => a.next_follow_up && a.next_follow_up <= now && !a.response_received && a.status !== 'closed');
  if (!due.length) return;
  chrome.notifications.create('jhos-followups', {
    type: 'list',
    iconUrl: 'icons/icon128.png',
    title: `${due.length} follow-up${due.length > 1 ? 's' : ''} due today`,
    message: 'Open Job Hunt OS to send them.',
    items: due.slice(0, 5).map((a) => ({ title: a.company || 'Role', message: `${a.title || ''} — ${a.follow_up_stage_label || 'follow up'}` })),
    priority: 1,
  });
});

chrome.notifications.onClicked.addListener(async () => {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab) queue(tab, 'pipeline');
});
