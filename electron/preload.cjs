const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tkDesktop', {
  isDesktop: true,
  loadSettings: () => ipcRenderer.invoke('tk:load-settings'),
  saveSettings: (value) => ipcRenderer.invoke('tk:save-settings', value),
  loadAuth: () => ipcRenderer.invoke('tk:load-auth'),
  saveAuth: (value) => ipcRenderer.invoke('tk:save-auth', value),
  clearAuth: () => ipcRenderer.invoke('tk:clear-auth'),
  loadHistory: (accountId) => ipcRenderer.invoke('tk:load-history', accountId),
  saveHistory: (accountId, records) => ipcRenderer.invoke('tk:save-history', accountId, records),
  getUpdateState: () => ipcRenderer.invoke('tk:update-state'),
  getVersion: () => ipcRenderer.invoke('tk:get-version'),
  checkForUpdates: () => ipcRenderer.invoke('tk:check-update'),
  downloadUpdate: () => ipcRenderer.invoke('tk:download-update'),
  installUpdate: () => ipcRenderer.invoke('tk:install-update'),
  openExternal: (url) => ipcRenderer.invoke('tk:open-external', url),
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('tk:update-status', handler);
    return () => ipcRenderer.removeListener('tk:update-status', handler);
  },
});
