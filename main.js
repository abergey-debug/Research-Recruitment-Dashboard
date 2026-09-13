const { app, BrowserWindow, ipcMain, clipboard, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const os   = require('os');
const { execFile } = require('child_process');

const PDF_FOLDERS = [
  path.join(os.homedir(), 'Research Recruitment Dashboard', 'Research Files', 'Call Files'),
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


function createWindow() {
  mainWin = new BrowserWindow({
    width: 1600,
    height: 950,
    title: 'Research Recruitment Dashboard',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWin.loadFile('index.html');

  mainWin.webContents.on('did-attach-webview', (event, wc) => {
    webviewContents.set(wc.id, wc);
    wc.on('destroyed', () => webviewContents.delete(wc.id));
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
    shell.openPath(path.join(os.homedir(), 'Research Recruitment Dashboard', 'Research Files'));
  });

  ipcMain.handle('scan-onedrive', () => {
    const text = clipboard.readText();
    if (!text || !text.trim()) {
      return { error: 'Clipboard is empty. Select your rows in Excel, press Ctrl+C, then click Paste.' };
    }
    return { text };
  });

  ipcMain.handle('send-email', (e, { to, name }) => {
    const emailDir = path.join(os.homedir(), 'Research Recruitment Dashboard', 'Research Files', 'Email Files');
    const firstName = (name || '').split(' ')[0] || 'there';
    const attachments = [
      path.join(emailDir, 'Participant_FAQ_English.pdf'),
      path.join(emailDir, 'PREVENTABLE_Non-VA_Sites_ICF_Part 1.pdf'),
      path.join(emailDir, 'Trifold_Brochure_English.pdf'),
    ];

    const attachLines = attachments
      .map(f => `make new attachment at newMsg with properties {file:POSIX file "${f}"}`)
      .join('\n  ');

    const htmlBody = [
      `<p>${firstName},</p>`,
      `<p>Thank you for your interest in PREVENTABLE!&nbsp; It was a pleasure connecting with you today.&nbsp; I've attached the consent documents for the study as they contain comprehensive information on how it operates, expectations for participants, and associated risks.&nbsp; <b>Please note that these are purely for your review; if you choose to move forward with participating we would formally complete them at a later time.</b></p>`,
      `<p>If you have any questions or concerns, or you would like to proceed with scheduling a meeting to enroll, feel free to reply to this email or give me a call at 770-330-7790.&nbsp; I would also recommend you visit the PREVENTABLE website (<a href='https://preventabletrial.org/home.cfm'>https://preventabletrial.org/home.cfm</a>) and register for one of their weekly webinars; they are an excellent source of information.</p>`,
      `<p>Best,</p>`,
    ].join('');

    // AppleScript doesn't support backslash escapes — split on any double quotes and rejoin with & quote &
    const asHtml = '"' + htmlBody.replace(/"/g, '" & quote & "') + '"';

    const script = `if application "Microsoft Outlook" is not running then
  tell application "Microsoft Outlook" to launch
  repeat until application "Microsoft Outlook" is running
    delay 0.3
  end repeat
  delay 2
end if

tell application "Microsoft Outlook"
  activate
  set newMsg to make new outgoing message with properties {subject:"PREVENTABLE Trial - Study Information"}
  set content of newMsg to ${asHtml}
  make new recipient at newMsg with properties {email address:{address:"${to}"}}
  ${attachLines}
  open newMsg
  activate
end tell`;

    const tmpScript = path.join(os.tmpdir(), 'preventable_email.scpt');
    fs.writeFileSync(tmpScript, script, 'utf8');

    return new Promise((resolve) => {
      execFile('osascript', [tmpScript], (err) => {
        if (err) resolve({ error: err.message });
        else resolve({ success: true });
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
