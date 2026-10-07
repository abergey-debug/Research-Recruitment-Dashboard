const { app, BrowserWindow, ipcMain, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execFile } = require('child_process');
const { pathToFileURL } = require('url');
const { loadEmailTemplate, fillPlaceholders, toAsciiHtml, listAttachments } = require('./email-template');

const PDF_FOLDERS = [
  path.join(__dirname, 'Research Files', 'Call Files'),
];

function getPDFFiles() {
  const files = [];
  for (const folder of PDF_FOLDERS) {
    if (!fs.existsSync(folder)) continue;
    const folderName = path.basename(folder);
    const pdfs = fs.readdirSync(folder)
      .filter(f => f.toLowerCase().endsWith('.pdf'))
      .map(f => ({
        name: f.replace(/\.pdf$/i, ''),
        path: path.join(folder, f),
        url: pathToFileURL(path.join(folder, f)).href,
        folder: folderName,
      }));
    files.push(...pdfs);
  }
  return files;
}

let mainWin = null;
const webviewContents = new Map();

// ── Voicemail message (played into a call when it reaches voicemail) ──
const VOICEMAIL_DIR = app.getPath('userData');
const VOICEMAIL_MIME_BY_EXT = {
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
  '.aac': 'audio/aac', '.ogg': 'audio/ogg', '.webm': 'audio/webm', '.caf': 'audio/x-caf',
};

function findVoicemailFile() {
  if (!fs.existsSync(VOICEMAIL_DIR)) return null;
  const match = fs.readdirSync(VOICEMAIL_DIR).find(f => f.startsWith('voicemail-message.'));
  return match ? path.join(VOICEMAIL_DIR, match) : null;
}

function readVoicemailMessage() {
  const file = findVoicemailFile();
  if (!file) return null;
  const ext = path.extname(file).toLowerCase();
  const mime = VOICEMAIL_MIME_BY_EXT[ext] || 'audio/mpeg';
  const data = fs.readFileSync(file).toString('base64');
  return { dataUrl: `data:${mime};base64,${data}`, fileName: path.basename(file) };
}


// ── Hotkey: Cmd+Shift+P (Mac) / Ctrl+Shift+P (Windows) plays/stops the
// voicemail message. Caught via before-input-event on the main window AND
// every webview, since a keydown listener in index.html never sees keys
// pressed while focus is inside the Google Voice/OneDrive panels.
function isPlayHotkey(input) {
  const mod = process.platform === 'darwin' ? input.meta : input.control;
  return input.type === 'keyDown' && !input.isAutoRepeat && mod && input.shift
    && !input.alt && input.code === 'KeyP';
}

function attachPlayHotkey(wc) {
  wc.on('before-input-event', (event, input) => {
    if (!isPlayHotkey(input)) return;
    event.preventDefault();
    if (mainWin && !mainWin.isDestroyed()) mainWin.webContents.send('toggle-voicemail-play');
  });
}

// ── Email greeting ──
// Spreadsheet names come as either "Last, First" or "First Last", sometimes
// in ALL CAPS. With a SEX/GENDER column: "Dear Mr. Doe," / "Dear Ms. Doe,".
// Without one there's no safe way to pick a title, so: "Dear John Doe,".
function tidyNamePart(word) {
  if (word !== word.toUpperCase() && word !== word.toLowerCase()) return word; // already mixed case
  return word.toLowerCase().replace(/(^|[-'’])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
}

function splitPatientName(name) {
  const raw = String(name || '').split('\n')[0].trim();
  if (!raw) return { first: '', last: '' };
  let first = '', last = '';
  if (raw.includes(',')) {
    const [lastPart, ...rest] = raw.split(',');
    last  = lastPart.trim();
    first = rest.join(' ').trim().split(/\s+/)[0] || '';
  } else {
    const parts = raw.split(/\s+/);
    first = parts[0];
    last  = parts.length > 1 ? parts[parts.length - 1] : '';
  }
  return {
    first: first.split(/\s+/).map(tidyNamePart).join(' '),
    last:  last.split(/\s+/).map(tidyNamePart).join(' '),
  };
}

function buildEmailGreeting(name, sex) {
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const { first, last } = splitPatientName(name);
  const s = String(sex || '').trim().toLowerCase();
  const title = /^(m|male|man)$/.test(s) ? 'Mr.' : /^(f|female|woman)$/.test(s) ? 'Ms.' : '';
  if (title && last) return `Dear ${title} ${esc(last)},`;
  const full = [first, last].filter(Boolean).join(' ');
  return full ? `Dear ${esc(full)},` : 'Hello,';
}

function createWindow() {
  mainWin = new BrowserWindow({
    width: 1600,
    height: 950,
    title: 'Research Recruitment Dashboard',
    icon: path.join(__dirname, 'app-icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWin.loadFile('index.html');
  attachPlayHotkey(mainWin.webContents);

  mainWin.webContents.on('did-attach-webview', (event, wc) => {
    webviewContents.set(wc.id, wc);
    wc.on('destroyed', () => webviewContents.delete(wc.id));
    attachPlayHotkey(wc);
    // The Google Voice panel is hidden (display:none) by default now, and
    // Chromium throttles JS timers in backgrounded/hidden pages to save
    // resources — which can interfere with an active WebRTC call's own
    // logic. Keep both webviews running at full priority regardless of
    // visibility.
    wc.setBackgroundThrottling(false);
    wc.setWindowOpenHandler(({ url }) => {
      mainWin.webContents.send('open-in-panel', url);
      return { action: 'deny' };
    });
  });

  mainWin.webContents.on('did-create-window', (popup) => {
    const authDone = ['voice.google.com', 'sharepoint.com', 'onedrive.live.com'];
    const check = (url) => {
      if (authDone.some(d => url.includes(d))) {
        mainWin.webContents.send('auth-complete', url);
        popup.destroy();
      }
    };
    popup.webContents.on('did-navigate',    (e, url) => check(url));
    popup.webContents.on('did-finish-load', ()       => check(popup.webContents.getURL()));
  });
}

app.whenReady().then(() => {
  ipcMain.handle('get-pdf-files', () => getPDFFiles());

  ipcMain.handle('open-folder', () => {
    shell.openPath(path.join(__dirname, 'Research Files'));
  });

  ipcMain.handle('scan-onedrive', () => {
    const text = clipboard.readText();
    if (!text || !text.trim()) {
      return { error: 'Clipboard is empty. Select your rows in Excel, press Ctrl+C, then click Paste.' };
    }
    return { text };
  });

  ipcMain.handle('send-email', (e, { to, name, sex }) => {
    // The email text and attachments are editable files, not code - see
    // email-template.js. Re-read on every click so edits apply immediately.
    const emailDir = path.join(__dirname, 'Research Files', 'Email Files');
    const { first, last } = splitPatientName(name);
    const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const values = { greeting: buildEmailGreeting(name, sex), first: esc(first), last: esc(last) };

    const template = loadEmailTemplate(emailDir);
    const htmlBody = toAsciiHtml(fillPlaceholders(template.html, values));
    const subject  = fillPlaceholders(template.subject, { ...values, greeting: '' }).trim();
    const attachments = listAttachments(emailDir);
    const done = (result) => (template.warning && !result.error ? { ...result, warning: template.warning } : result);

    if (process.platform === 'win32') {
      // Windows has no AppleScript/Microsoft Outlook scripting bridge, so drive
      // desktop Outlook through its COM object model instead, via PowerShell.
      const psQuote = (str) => `'${String(str).replace(/'/g, "''")}'`;

      const script = [
        '$outlook = New-Object -ComObject Outlook.Application',
        '$mail = $outlook.CreateItem(0)',
        `$mail.Subject = ${psQuote(subject)}`,
        `$mail.HTMLBody = ${psQuote(htmlBody)}`,
        `$mail.To = ${psQuote(to)}`,
        ...attachments.map(f => `$mail.Attachments.Add(${psQuote(f)})`),
        '$mail.Display()',
      ].join('\r\n');

      const tmpScript = path.join(os.tmpdir(), 'preventable_email.ps1');
      // BOM so Windows PowerShell reads a non-ASCII subject line as UTF-8
      fs.writeFileSync(tmpScript, '\ufeff' + script, 'utf8');

      return new Promise((resolve) => {
        // -Sta: Outlook's COM interop requires a single-threaded apartment.
        execFile('powershell.exe', [
          '-NoProfile', '-NonInteractive', '-Sta',
          '-ExecutionPolicy', 'Bypass',
          '-File', tmpScript,
        ], (err, stdout, stderr) => {
          if (err) resolve({ error: stderr?.toString().trim() || err.message });
          else resolve(done({ success: true }));
        });
      });
    }

    // AppleScript doesn't support backslash escapes — split on any double quotes and rejoin with & quote &
    const asQuote = (str) => '("' + String(str).replace(/"/g, '" & quote & "') + '")';
    const asHtml = asQuote(htmlBody);

    const attachLines = attachments
      .map(f => `make new attachment at newMsg with properties {file:POSIX file ${asQuote(f)}}`)
      .join('\n  ');

    const script = `if application "Microsoft Outlook" is not running then
  tell application "Microsoft Outlook" to launch
  repeat until application "Microsoft Outlook" is running
    delay 0.3
  end repeat
  delay 2
end if

tell application "Microsoft Outlook"
  activate
  set newMsg to make new outgoing message with properties {subject:${asQuote(subject)}}
  set content of newMsg to ${asHtml}
  make new recipient at newMsg with properties {email address:{address:${asQuote(to)}}}
  ${attachLines}
  open newMsg
  activate
end tell`;

    const tmpScript = path.join(os.tmpdir(), 'preventable_email.scpt');
    fs.writeFileSync(tmpScript, script, 'utf8');

    return new Promise((resolve) => {
      execFile('osascript', [tmpScript], (err) => {
        if (err) resolve({ error: err.message });
        else resolve(done({ success: true }));
      });
    });
  });

  ipcMain.handle('get-voicemail-message', () => readVoicemailMessage());

  ipcMain.handle('pick-voicemail-file', async () => {
    const result = await dialog.showOpenDialog(mainWin, {
      title: 'Choose Voicemail Message Audio File',
      properties: ['openFile'],
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg', 'webm', 'caf'] }],
    });
    if (result.canceled || !result.filePaths.length) return null;

    const src = result.filePaths[0];
    const ext = path.extname(src).toLowerCase();

    fs.mkdirSync(VOICEMAIL_DIR, { recursive: true });
    fs.readdirSync(VOICEMAIL_DIR)
      .filter(f => f.startsWith('voicemail-message.'))
      .forEach(f => fs.unlinkSync(path.join(VOICEMAIL_DIR, f)));

    fs.copyFileSync(src, path.join(VOICEMAIL_DIR, `voicemail-message${ext}`));
    return readVoicemailMessage();
  });

  createWindow();
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
