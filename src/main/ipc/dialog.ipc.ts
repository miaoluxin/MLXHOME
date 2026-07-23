import { BrowserWindow, ipcMain, dialog } from 'electron';
import { IPC } from '../../shared/ipc-channels';

export function registerDialogIpc(mainWindow: BrowserWindow) {
  ipcMain.handle(IPC.DIALOG_OPEN_FOLDER, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择项目文件夹',
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: '另存为',
      buttonLabel: '保存',
      filters: [
        { name: '所有文件 (*.*)', extensions: ['*'] },
      ],
    });
    if (result.canceled || !result.filePath) return null;
    return result.filePath;
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      title: '打开文件',
      filters: [
        { name: '所有文件 (*.*)', extensions: ['*'] },
        { name: '文本文件', extensions: ['txt', 'md', 'js', 'ts', 'jsx', 'tsx', 'json', 'html', 'css', 'py', 'java', 'c', 'cpp', 'xml', 'yaml', 'yml', 'sql', 'sh', 'bat', 'ini', 'log'] },
      ],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
