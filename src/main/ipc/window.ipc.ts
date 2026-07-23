import { BrowserWindow, ipcMain } from 'electron';
import { IPC } from '../../shared/ipc-channels';

export function registerWindowIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(IPC.WINDOW_MINIMIZE, () => mainWindow.minimize());
  ipcMain.handle(IPC.WINDOW_MAXIMIZE, () => {
    if (mainWindow.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow.maximize();
    }
  });
  ipcMain.handle(IPC.WINDOW_CLOSE, () => mainWindow.close());
  ipcMain.handle(IPC.WINDOW_IS_MAXIMIZED, () => mainWindow.isMaximized());
  ipcMain.handle(IPC.WINDOW_SET_BG, (_event, color: string) => {
    mainWindow.setBackgroundColor(color);
  });
}
