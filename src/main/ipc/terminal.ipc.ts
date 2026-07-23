import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getTerminalManager } from '../services/terminal-manager';

const manager = getTerminalManager();

export function registerTerminalIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(IPC.TERMINAL_CREATE, (_event, options) => {
    const sessionId = manager.create({ ...options, createdBy: 'local' });
    manager.onData(sessionId, (data) => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.TERMINAL_ON_DATA, sessionId, data);
      }
    });
    return sessionId;
  });

  ipcMain.handle(IPC.TERMINAL_WRITE, (_event, sessionId: string, data: string) => {
    manager.write(sessionId, data);
  });

  ipcMain.handle(IPC.TERMINAL_RESIZE, (_event, sessionId: string, cols: number, rows: number) => {
    manager.resize(sessionId, cols, rows);
  });

  ipcMain.handle(IPC.TERMINAL_KILL, (_event, sessionId: string) => {
    manager.kill(sessionId);
  });

  ipcMain.handle(IPC.TERMINAL_RENAME, (_event, sessionId: string, label: string) => {
    manager.rename(sessionId, label);
  });
}
