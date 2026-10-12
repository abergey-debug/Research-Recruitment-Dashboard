const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPDFFiles:    () => ipcRenderer.invoke('get-pdf-files'),
  scanOneDrive:   () => ipcRenderer.invoke('scan-onedrive'),
  openFolder:     () => ipcRenderer.invoke('open-folder'),
  sendEmail:      (data) => ipcRenderer.invoke('send-email', data),
  getVoicemailMessage: () => ipcRenderer.invoke('get-voicemail-message'),
  pickVoicemailFile:   () => ipcRenderer.invoke('pick-voicemail-file'),
  onAuthComplete: (cb) => ipcRenderer.on('auth-complete',  (e, url) => cb(url)),
  onOpenInPanel:  (cb) => ipcRenderer.on('open-in-panel',  (e, url) => cb(url)),
  onToggleVoicemailPlay: (cb) => ipcRenderer.on('toggle-voicemail-play', () => cb()),
  platform: process.platform,
  logUsage:       (event, detail) => ipcRenderer.invoke('usage-log', { event, detail }),
  getUsageInfo:   () => ipcRenderer.invoke('usage-get-info'),
  setUsageCode:   (code) => ipcRenderer.invoke('usage-set-code', code),
  exportUsageLog: () => ipcRenderer.invoke('usage-export'),
});
