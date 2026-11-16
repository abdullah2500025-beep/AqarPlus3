const { app, BrowserWindow, dialog, ipcMain, shell } = require('electron');
const fs = require('fs');
const net = require('net');
const path = require('path');
const { pathToFileURL } = require('url');

let mainWindow = null;
let httpServer = null;

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function findAvailablePort(preferredPort = 3000) {
  return new Promise((resolve, reject) => {
    const tester = net.createServer();
    tester.once('error', () => {
      const fallback = net.createServer();
      fallback.once('error', reject);
      fallback.listen(0, '127.0.0.1', () => {
        const addr = fallback.address();
        const port = typeof addr === 'object' && addr ? addr.port : 3000;
        fallback.close(() => resolve(port));
      });
    });
    tester.listen(preferredPort, '127.0.0.1', () => {
      tester.close(() => resolve(preferredPort));
    });
  });
}

async function startEmbeddedBackend() {
  const userDataDir = path.join(app.getPath('userData'), 'data');
  ensureDir(userDataDir);

  process.env.NODE_ENV = 'production';
  process.env.AQARPLUS_NO_AUTO_START = '1';
  process.env.AQARPLUS_USER_DATA_DIR = userDataDir;
  process.env.AQARPLUS_DIST_DIR = path.join(__dirname, '..', 'dist');

  const port = await findAvailablePort(3000);
  const serverEntry = path.join(__dirname, '..', 'dist-server', 'server.mjs');
  const mod = await import(pathToFileURL(serverEntry).href);
  const started = await mod.startServer(port);
  httpServer = started.server;
  return started.port;
}

function registerIpcHandlers() {
  ipcMain.handle('aqar:select-folder', async (_event, defaultPath, title) => {
    const result = await dialog.showOpenDialog(mainWindow || undefined, {
      title: title || 'اختر مجلد الحفظ',
      defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : app.getPath('documents'),
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });

  ipcMain.handle('aqar:open-path', async (_event, targetPath) => {
    if (!targetPath) return false;
    ensureDir(targetPath);
    const err = await shell.openPath(targetPath);
    return !err;
  });

  ipcMain.handle('aqar:get-default-paths', async () => {
    const baseDocs = path.join(app.getPath('documents'), 'AqarPlus');
    const paths = {
      userData: path.join(app.getPath('userData'), 'data'),
      backupsDir: path.join(baseDocs, 'Backups'),
      archiveDir: path.join(baseDocs, 'Archive'),
      documentsDir: path.join(baseDocs, 'Documents'),
    };
    ensureDir(paths.backupsDir);
    ensureDir(paths.archiveDir);
    ensureDir(paths.documentsDir);
    return paths;
  });
}

function createWindow(port) {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 880,
    minWidth: 1024,
    minHeight: 700,
    title: 'AqarPlus — نظام إدارة العقارات المتكامل',
    autoHideMenuBar: true,
    backgroundColor: '#0B1120',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost')) {
      return { action: 'allow' };
    }
    if (url.startsWith('https://') || url.startsWith('http://') || url.startsWith('mailto:') || url.startsWith('tel:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  void mainWindow.loadURL(`http://127.0.0.1:${port}`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(async () => {
    try {
      registerIpcHandlers();
      const port = await startEmbeddedBackend();
      createWindow(port);
    } catch (err) {
      dialog.showErrorBox('AqarPlus Startup Error', err instanceof Error ? err.message : String(err));
      app.quit();
    }
  });

  app.on('window-all-closed', () => {
    if (httpServer) {
      try {
        httpServer.close();
      } catch {
        // ignore close error
      }
    }
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}
