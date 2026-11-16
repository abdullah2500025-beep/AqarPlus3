const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aqarDesktop', {
  isElectron: true,
  platform: process.platform,
  selectFolder: (defaultPath, title) => ipcRenderer.invoke('aqar:select-folder', defaultPath, title),
  openPath: (targetPath) => ipcRenderer.invoke('aqar:open-path', targetPath),
  getDefaultPaths: () => ipcRenderer.invoke('aqar:get-default-paths'),
  isSafeStorageAvailable: () => ipcRenderer.invoke('aqar:is-safe-storage-available'),
  protectSecret: (plainText) => ipcRenderer.invoke('aqar:protect-secret', plainText),
  unprotectSecret: (cipherBase64) => ipcRenderer.invoke('aqar:unprotect-secret', cipherBase64),
});
