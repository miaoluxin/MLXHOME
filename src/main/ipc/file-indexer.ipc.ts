import { ipcMain, BrowserWindow, shell } from 'electron';
import { IPC } from '../../shared/ipc-channels';
import { getFileIndexer } from '../services/file-indexer';

export function registerFileIndexerIpc(mainWindow: BrowserWindow): void {
  const indexer = getFileIndexer();

  // ── 搜索 ──
  ipcMain.handle(IPC.FILE_INDEXER_SEARCH, (_event, query: string) => {
    return indexer.search(query);
  });

  // ── 状态 ──
  ipcMain.handle(IPC.FILE_INDEXER_STATUS, () => {
    return indexer.getStatus();
  });

  // ── 启动索引 ──
  ipcMain.handle(IPC.FILE_INDEXER_START, async (_event, roots?: string[]) => {
    await indexer.start(roots);
  });

  // ── 重新索引 ──
  ipcMain.handle(IPC.FILE_INDEXER_REINDEX, async (_event, roots?: string[]) => {
    await indexer.reindex(roots);
  });

  // ── 进度事件转发 ──
  indexer.onProgress((data) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.FILE_INDEXER_PROGRESS, data);
    }
  });

  // ── 就绪事件转发 ──
  indexer.onReady(() => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.FILE_INDEXER_READY);
    }
  });

  // ── 用系统默认程序打开文件 ──
  ipcMain.handle(IPC.FS_OPEN_FILE, async (_event, filePath: string) => {
    const error = await shell.openPath(filePath);
    if (error) throw new Error(error);
  });
}
