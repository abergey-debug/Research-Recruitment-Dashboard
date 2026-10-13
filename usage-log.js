// Usage log for the lab's implementation study: one CSV line per action
// (what kind of action, and when) so adoption and feature use can be
// measured. Always on. Deliberately records NO patient information - only
// event names from the fixed list below plus short, non-identifying details
// (a count, "cell"/"home", "button"/"hotkey", a script's file name).
const { app, ipcMain, dialog } = require('electron');
const fs   = require('fs');
const path = require('path');

const LOG_FILE      = path.join(app.getPath('userData'), 'usage-log.csv');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'usage-settings.json');
const HEADER = 'timestamp,participant_code,event,detail,app_version,platform\n';

// Each event may carry only the kind of detail listed here; anything else is
// blanked. Events not on this list are dropped entirely. So even a coding
// mistake elsewhere can't put a name, number, or address into the log.
const NONE    = () => '';
const COUNT   = (d) => (/^\d{1,4}$/.test(String(d)) ? String(d) : '');
const ONE_OF  = (...allowed) => (d) => (allowed.includes(d) ? d : '');
const TRIGGER = ONE_OF('button', 'hotkey');
// How a call ended, plus seconds connected when it did connect: "auto_hangup 68"
const CALL_END = (d) => (/^(hangup_button|auto_hangup|line_closed|new_call)( \d{1,5})?$/.test(String(d)) ? String(d) : '');
// A script's file name from Research Files/Call Files (not patient data)
const SCRIPT  = (d) => String(d ?? '').replace(/[^A-Za-z0-9 ._-]/g, '_').slice(0, 60);

const EVENTS = {
  app_opened: NONE, app_closed: NONE, participant_code_set: NONE, log_exported: NONE,
  // The dashboard window lost / regained focus (switching to another app)
  app_left: NONE, app_returned: NONE,
  patients_loaded: COUNT, patient_changed: NONE,
  call_started: ONE_OF('cell', 'home'), call_connected: NONE, call_ended: CALL_END, hangup_clicked: NONE, auto_hangup: NONE,
  voicemail_uploaded: NONE, voicemail_play_started: TRIGGER, voicemail_play_finished: NONE,
  voicemail_play_stopped: TRIGGER, voicemail_play_failed: TRIGGER,
  mic_muted: NONE, mic_unmuted: NONE,
  email_opened: NONE, email_failed: NONE,
  script_changed: SCRIPT, voice_panel_shown: NONE, voice_panel_hidden: NONE, onedrive_home: NONE,
};

function readSettings() {
  try { return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')); } catch (e) { return {}; }
}

const cleanCode = (code) => String(code || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 20);

function logEvent(event, detail) {
  if (!Object.hasOwn(EVENTS, event)) return;
  try {
    if (!fs.existsSync(LOG_FILE)) fs.writeFileSync(LOG_FILE, HEADER, 'utf8');
    const line = [
      new Date().toISOString(), cleanCode(readSettings().code), event, EVENTS[event](detail),
      app.getVersion(), process.platform,
    ].join(',') + '\n';
    fs.appendFileSync(LOG_FILE, line, 'utf8');
  } catch (e) { /* logging must never break the app */ }
}

function countEvents() {
  try { return Math.max(0, fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).length - 1); } catch (e) { return 0; }
}

function registerUsageLog(getWindow) {
  ipcMain.handle('usage-log', (e, { event, detail } = {}) => logEvent(event, detail));

  ipcMain.handle('usage-get-info', () => ({ code: cleanCode(readSettings().code), events: countEvents() }));

  ipcMain.handle('usage-set-code', (e, code) => {
    const cleaned = cleanCode(code);
    const previous = cleanCode(readSettings().code);
    if (cleaned !== previous) {
      fs.writeFileSync(SETTINGS_FILE, JSON.stringify({ ...readSettings(), code: cleaned }), 'utf8');
      logEvent('participant_code_set'); // only when it actually changes
    }
    return { code: cleaned, events: countEvents() };
  });

  ipcMain.handle('usage-export', async () => {
    if (!fs.existsSync(LOG_FILE)) return { error: 'Nothing has been recorded yet.' };
    const code = cleanCode(readSettings().code) || 'no-code';
    const result = await dialog.showSaveDialog(getWindow(), {
      title: 'Export Usage Log',
      defaultPath: path.join(app.getPath('desktop'), `dashboard-usage-${code}-${new Date().toISOString().slice(0, 10)}.csv`),
      filters: [{ name: 'CSV', extensions: ['csv'] }],
    });
    if (result.canceled || !result.filePath) return null;
    fs.copyFileSync(LOG_FILE, result.filePath);
    logEvent('log_exported');
    return { path: result.filePath };
  });
}

// Session start/end and switching away to other apps, per dashboard window.
// A crash or force-quit leaves no app_closed; the next app_opened marks it.
function trackWindow(win) {
  logEvent('app_opened');
  let away = false;
  win.on('blur',  () => { if (!away) { away = true;  logEvent('app_left'); } });
  win.on('focus', () => { if (away)  { away = false; logEvent('app_returned'); } });
  win.on('closed', () => logEvent('app_closed'));
}

module.exports = { registerUsageLog, trackWindow };
