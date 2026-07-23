import { app, BrowserWindow } from 'electron';
import path from 'path';
import { registerTerminalIpc } from './ipc/terminal.ipc';
import { registerFilesystemIpc } from './ipc/filesystem.ipc';
import { registerDialogIpc } from './ipc/dialog.ipc';
import { registerWindowIpc } from './ipc/window.ipc';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    show: false,
    backgroundColor: '#1a1b26',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

  registerTerminalIpc(mainWindow!);
  registerFilesystemIpc(mainWindow!);
  registerDialogIpc(mainWindow!);
  registerWindowIpc(mainWindow!);

  mainWindow!.once('ready-to-show', () => {
    Promise.all([
      import('./ipc/plantuml.ipc'),
      import('./ipc/file-indexer.ipc'),
      import('./ipc/claude-tools.ipc'),
      import('./ipc/prompts.ipc'),
    ]).then(([plantuml, fileIndexer, claudeTools, prompts]) => {
      plantuml.registerPlantumlIpc();
      fileIndexer.registerFileIndexerIpc(mainWindow!);
      claudeTools.registerClaudeToolsIpc();
      prompts.registerPromptsIpc();
    }).catch((err) => {
      console.error('[Main] 非关键IPC注册失败:', err);
    });
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', async () => {
  try {
    const { getFileIndexer } = await import('./services/file-indexer');
    getFileIndexer().stop();
  } catch { /* 索引器可能未加载，忽略 */ }
});
