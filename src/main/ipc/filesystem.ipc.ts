import { ipcMain, shell, BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import chokidar from 'chokidar';
import { IPC } from '../../shared/ipc-channels';
import type { FileEntry } from '../../shared/types';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatDate(date: Date): string {
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

async function listDirectory(dirPath: string): Promise<FileEntry[]> {
  const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const results: FileEntry[] = [];

  for (const entry of entries) {
    try {
      const fullPath = path.join(dirPath, entry.name);
      const stat = await fs.promises.stat(fullPath);
      results.push({
        name: entry.name,
        path: fullPath,
        isDirectory: entry.isDirectory(),
        size: stat.size,
        modified: formatDate(stat.mtime),
        extension: path.extname(entry.name).toLowerCase(),
      });
    } catch {
      // skip inaccessible files
    }
  }

  results.sort((a, b) => {
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return results;
}

async function listDrives(): Promise<string[]> {
  const drives: string[] = [];
  for (let i = 65; i <= 90; i++) {
    const letter = String.fromCharCode(i);
    const drivePath = `${letter}:\\`;
    try {
      await fs.promises.access(drivePath, fs.constants.F_OK);
      drives.push(drivePath);
    } catch {
      // 驱动器不存在，跳过
    }
  }
  return drives;
}

// ── 文件系统变更监听（chokidar） ──
let watcher: ReturnType<typeof chokidar.watch> | null = null;
let watchDebounceTimer: NodeJS.Timeout | null = null;
let mainWindowRef: BrowserWindow | null = null;

function sendChange(eventType: string, filePath: string) {
  if (mainWindowRef && !mainWindowRef.isDestroyed()) {
    if (watchDebounceTimer) clearTimeout(watchDebounceTimer);
    watchDebounceTimer = setTimeout(() => {
      mainWindowRef?.webContents.send(IPC.FS_ON_CHANGE, eventType, filePath);
    }, 300);
  }
}

function startWatching(dirPath: string) {
  stopWatching();
  if (!dirPath) return;
  try {
    watcher = chokidar.watch(dirPath, {
      ignored: [
        /(^|[\/\\])\.\w+/,           // dotfiles
        /[\/\\]node_modules[\/\\]/,
        /[\/\\]\.git[\/\\]/,
        /\.tmp$/,
        /~\d*$/,
        /\.swp$/,
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 10,
    });

    watcher
      .on('add', (p: string) => sendChange('add', p))
      .on('unlink', (p: string) => sendChange('unlink', p))
      .on('change', (p: string) => sendChange('change', p))
      .on('addDir', (p: string) => sendChange('addDir', p))
      .on('unlinkDir', (p: string) => sendChange('unlinkDir', p));
  } catch (err) {
    console.error('[filesystem] 启动文件监听失败:', err);
  }
}

function stopWatching() {
  if (watcher) {
    watcher.close();
    watcher = null;
  }
  if (watchDebounceTimer) {
    clearTimeout(watchDebounceTimer);
    watchDebounceTimer = null;
  }
}

export function registerFilesystemIpc(mainWindow: BrowserWindow) {
  mainWindowRef = mainWindow;
  ipcMain.handle(IPC.FS_LIST, async (_event, dirPath: string) => {
    return listDirectory(dirPath);
  });

  ipcMain.handle(IPC.FS_READ, async (_event, filePath: string) => {
    return fs.promises.readFile(filePath, 'utf-8');
  });

  ipcMain.handle(IPC.FS_READ_BINARY, async (_event, filePath: string) => {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.toString('base64');
  });

  ipcMain.handle(IPC.FS_GET_FILE_INFO, async (_event, filePath: string) => {
    const stat = await fs.promises.stat(filePath);
    // 检测换行符 — 读取前 64KB 样本
    let lineEnding: 'CRLF' | 'LF' | 'CR' = 'LF';
    try {
      const fd = await fs.promises.open(filePath, 'r');
      const buffer = Buffer.alloc(65536);
      const { bytesRead } = await fd.read(buffer, 0, 65536, 0);
      await fd.close();
      const sample = buffer.toString('utf-8', 0, bytesRead);
      if (sample.includes('\r\n')) lineEnding = 'CRLF';
      else if (sample.includes('\r')) lineEnding = 'CR';
      else lineEnding = 'LF';
    } catch { /* 默认 LF */ }
    return {
      size: stat.size,
      modified: formatDate(stat.mtime),
      lineEnding,
    };
  });

  ipcMain.handle(IPC.FS_WRITE, async (_event, filePath: string, content: string) => {
    await fs.promises.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle(IPC.FS_STAT, async (_event, filePath: string) => {
    const stat = await fs.promises.stat(filePath);
    return {
      size: stat.size,
      modified: formatDate(stat.mtime),
      isDirectory: stat.isDirectory(),
    };
  });

  ipcMain.handle(IPC.FS_CREATE_DIR, async (_event, parentPath: string, name: string) => {
    await fs.promises.mkdir(path.join(parentPath, name));
  });

  ipcMain.handle(IPC.FS_DELETE, async (_event, targetPath: string) => {
    const stat = await fs.promises.stat(targetPath);
    if (stat.isDirectory()) {
      await fs.promises.rm(targetPath, { recursive: true });
    } else {
      await fs.promises.unlink(targetPath);
    }
  });

  ipcMain.handle(IPC.FS_RENAME, async (_event, oldPath: string, newPath: string) => {
    await fs.promises.rename(oldPath, newPath);
  });

  ipcMain.handle(IPC.FS_LIST_DRIVES, async () => {
    return listDrives();
  });

  ipcMain.handle(IPC.FS_SHOW_IN_FOLDER, async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
  });

  ipcMain.handle(IPC.FS_COPY_FILE, async (_event, srcPath: string, destPath: string) => {
    await fs.promises.copyFile(srcPath, destPath);
  });

  ipcMain.handle(IPC.FS_START_WATCH, async (_event, dirPath: string) => {
    startWatching(dirPath);
  });

  // ── 跨文件内容搜索 ──
  ipcMain.handle(IPC.CONTENT_SEARCH, async (_event, rootDir: string, query: string) => {
    if (!query || query.length < 2) return [];
    const results: Array<{ file: string; line: number; column: number; lineContent: string }> = [];

    // 尝试使用 ripgrep，不可用时回退到 Node.js 搜索
    const rgResult = await new Promise<string | null>((resolve) => {
      const rg = spawn('rg', ['-n', '--no-heading', '--smart-case', '-g', '!node_modules', '-g', '!.git', '--max-count', '50', query, rootDir], { shell: true, timeout: 15000 });
      let out = '';
      rg.stdout.on('data', (d: Buffer) => out += d.toString());
      rg.on('error', () => resolve(null));
      rg.on('close', (code) => { resolve(code === 0 || code === 1 ? out : null); });
    });

    if (rgResult !== null) {
      const lines = rgResult.trim().split('\n').filter(Boolean).slice(0, 200);
      for (const line of lines) {
        const match = line.match(/^(.+?):(\d+):(\d+)?:(.*)/);
        if (match) {
          results.push({ file: match[1], line: parseInt(match[2]), column: match[3] ? parseInt(match[3]) : 1, lineContent: (match[4] || '').trim().substring(0, 200) });
        }
      }
    } else {
      // 回退：递归扫描文本文件
      const textExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.java', '.rs', '.go', '.c', '.cpp', '.h', '.hpp', '.cs', '.rb', '.php', '.vue', '.svelte', '.html', '.css', '.scss', '.less', '.json', '.xml', '.yaml', '.yml', '.toml', '.ini', '.md', '.txt', '.sh', '.bat', '.ps1', '.sql', '.env', '.gitignore', '.dockerfile', '.cfg', '.conf', '.gradle', '.mjs', '.cjs', '.mts', '.cts']);
      const searchStack: string[] = [rootDir];
      const MAX_FILES = 500;

      while (searchStack.length > 0 && results.length < 200) {
        const dir = searchStack.pop()!;
        try {
          const entries = await fs.promises.readdir(dir, { withFileTypes: true });
          for (const entry of entries) {
            if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
              if (searchStack.length < MAX_FILES) searchStack.push(fullPath);
            } else if (textExts.has(path.extname(entry.name).toLowerCase())) {
              try {
                const content = await fs.promises.readFile(fullPath, 'utf-8');
                const contentLines = content.split('\n');
                const qLower = query.toLowerCase();
                for (let i = 0; i < contentLines.length; i++) {
                  const idx = contentLines[i].toLowerCase().indexOf(qLower);
                  if (idx >= 0) {
                    results.push({ file: fullPath, line: i + 1, column: idx + 1, lineContent: contentLines[i].trim().substring(0, 200) });
                    if (results.length >= 200) break;
                  }
                }
              } catch { /* skip unreadable */ }
            }
          }
        } catch { /* skip inaccessible */ }
      }
    }
    return results;
  });
}
