const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getPDFFiles:    () => ipcRenderer.invoke('get-pdf-files'),
  getPDFData:     (filePath) => ipcRenderer.invoke('get-pdf-data', filePath),
  scanOneDrive:   () => ipcRenderer.invoke('scan-onedrive'),
  openFolder:     () => ipcRenderer.invoke('open-folder'),
  sendEmail:      (data) => ipcRenderer.invoke('send-email', data),
  onAuthComplete: (cb) => ipcRenderer.on('auth-complete',  (e, url) => cb(url)),
  onOpenInPanel:  (cb) => ipcRenderer.on('open-in-panel',  (e, url) => cb(url)),
});
