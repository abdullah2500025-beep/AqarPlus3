const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('aqarDesktop', {
  isElectron: true,
  platform: process.platform,
  selectFolder: (defaultPath, title) => ipcRenderer.invoke('aqar:select-folder', defaultPath, title),
  openPath: (targetPath) => ipcRenderer.invoke('aqar:open-path', targetPath),
  getDefaultPaths: () => ipcRenderer.invoke('aqar:get-default-paths'),
});
