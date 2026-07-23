import fs from 'fs';
import path from 'path';
import os from 'os';
import { serialize, deserialize } from 'v8';
import { app } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';
import type { SearchResult } from '../../shared/types';

interface IndexedEntry {
  path: string;
  name: string;
  size: number;
  mtime: number;
  isDirectory: boolean;
}

interface IndexSnapshot {
  version: number;
  timestamp: number;
  entries: Array<[string, IndexedEntry[]]>;
}

const INDEX_VERSION = 2;
const MAX_ENTRIES = 300000;
const MAX_DEPTH = 10;
const BATCH_SIZE = 50;
const YIELD_INTERVAL = 10;

const SKIP_DIRS = new Set([
  'Windows', 'WindowsApps', 'Windows.old',
  'Program Files', 'Program Files (x86)', 'ProgramData',
  '$Recycle.Bin', 'System Volume Information', 'Recovery',
  'PerfLogs', 'MSOCache', 'Intel', 'AMD', 'NVIDIA',
  'node_modules', '.git', '.svn', '.hg', '__pycache__',
  'AppData', 'build', 'dist', 'target', 'out', 'bin', 'obj',
  'vendor', 'bower_components', '.cache', 'tmp', 'temp',
  'log', 'logs', '.gradle', '.nuget', '.m2', 'Library',
  'packages', 'ThirdParty',
]);

function shouldSkipDir(name: string): boolean {
  if (name.startsWith('.')) return true;
  if (SKIP_DIRS.has(name)) return true;
  return false;
}

function formatDate(mtime: number): string {
  const d = new Date(mtime);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day} ${h}:${mi}`;
}

function yieldToEventLoop(): Promise<void> {
  return new Promise(resolve => setImmediate(resolve));
}

export class FileIndexer {
  private nameIndex = new Map<string, IndexedEntry[]>();
  private pathIndex = new Map<string, IndexedEntry>();
  private savedDriveRoots: string[] = [];

  private _isReady = false;
  private _isScanning = false;
  private indexedCount = 0;
  private abortScan = false;

  private watcher: FSWatcher | null = null;
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSaveTime = 0;

  private progressCb: ((data: { indexed: number; estimatedTotal: number }) => void) | null = null;
  private readyCb: (() => void) | null = null;
  private errorCb: ((err: string) => void) | null = null;

  get isReady() { return this._isReady; }
  get isScanning() { return this._isScanning; }

  onProgress(cb: (data: { indexed: number; estimatedTotal: number }) => void) { this.progressCb = cb; }
  onReady(cb: () => void) { this.readyCb = cb; }
  onError(cb: (err: string) => void) { this.errorCb = cb; }

  private get indexPath(): string {
    return path.join(app.getPath('userData'), 'mlx-file-index.dat');
  }

  async start(roots?: string[]): Promise<void> {
    if (this.loadIndex()) {
      this._isReady = true;
      this.readyCb?.();
      this.startWatching();
      return;
    }
    this.savedDriveRoots = roots && roots.length > 0 ? roots : [];
    if (this.savedDriveRoots.length === 0) {
      const home = process.env.USERPROFILE || os.homedir();
      if (home) this.savedDriveRoots = [home];
    }
    await this.fullScan();
  }

  search(query: string, maxResults = 500): SearchResult[] {
    if (!query || !query.trim()) return [];
    if (!this._isReady && !this._isScanning) return [];

    const lower = query.trim().toLowerCase();
    const scored: Array<{
      result: SearchResult;
      mtime: number;
      score: number;
    }> = [];

    for (const [name, entries] of this.nameIndex) {
      if (name.includes(lower)) {
        let score: number;
        if (name === lower) score = 0;
        else if (name.startsWith(lower)) score = 1;
        else score = 2;

        for (const entry of entries) {
          scored.push({
            result: {
              path: entry.path,
              name: entry.isDirectory ? entry.name : entry.name,
              isDirectory: entry.isDirectory,
              size: entry.size,
              modified: formatDate(entry.mtime),
            },
            mtime: entry.mtime,
            score,
          });
          if (scored.length >= maxResults * 2) break;
        }
      }
      if (scored.length >= maxResults * 2) break;
    }

    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return b.mtime - a.mtime;
    });

    return scored.slice(0, maxResults).map(r => r.result);
  }

  getStatus() {
    return {
      isReady: this._isReady,
      isScanning: this._isScanning,
      indexedCount: this.indexedCount,
    };
  }

  async reindex(roots?: string[]): Promise<void> {
    this.abortScan = true;
    this.stop();
    this.nameIndex.clear();
    this.pathIndex.clear();
    this.indexedCount = 0;
    this._isReady = false;
    this.abortScan = false;
    if (roots && roots.length > 0) {
      this.savedDriveRoots = roots;
    }
    await this.fullScan();
  }

  stop(): void {
    this.watcher?.close();
    this.watcher = null;
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }
    this._isReady = false;
    this._isScanning = false;
    this.saveIndex();
  }

  private loadIndex(): boolean {
    try {
      const p = this.indexPath;
      if (!fs.existsSync(p)) return false;
      const raw = fs.readFileSync(p);
      const data = deserialize(raw) as IndexSnapshot;
      if (data.version !== INDEX_VERSION) return false;

      this.nameIndex = new Map(data.entries);
      this.indexedCount = 0;
      for (const [, entries] of this.nameIndex) {
        this.indexedCount += entries.length;
        for (const e of entries) {
          this.pathIndex.set(e.path, e);
        }
      }
      // 不重置 driveRoots — 保留 start() 中设置的值
      return this.indexedCount > 0;
    } catch {
      return false;
    }
  }

  private saveIndex(): void {
    try {
      const snapshot: IndexSnapshot = {
        version: INDEX_VERSION,
        timestamp: Date.now(),
        entries: Array.from(this.nameIndex.entries()),
      };
      fs.writeFileSync(this.indexPath, serialize(snapshot));
      this.lastSaveTime = Date.now();
    } catch (err) {
      console.error('[FileIndexer] 保存索引失败:', err);
    }
  }

  private scheduleSave(): void {
    if (Date.now() - this.lastSaveTime > 5000) {
      this.saveIndex();
    }
  }

  private async fullScan(): Promise<void> {
    this._isScanning = true;
    this.nameIndex.clear();
    this.pathIndex.clear();
    this.indexedCount = 0;

    this.saveTimer = setInterval(() => this.saveIndex(), 30000);

    try {
      for (const root of this.savedDriveRoots) {
        if (this.abortScan) break;
        this.progressCb?.({ indexed: this.indexedCount, estimatedTotal: 0 });
        await this.scanDirectory(root);
      }

      if (!this.abortScan) {
        this._isReady = true;
        this.saveIndex();
        this.startWatching();
        this.readyCb?.();
      }
    } catch (err: any) {
      this.errorCb?.(err?.message || '索引扫描失败');
    } finally {
      this._isScanning = false;
      if (this.saveTimer) {
        clearInterval(this.saveTimer);
        this.saveTimer = null;
      }
    }
  }

  private async scanDirectory(rootDir: string): Promise<void> {
    const stack: string[] = [rootDir];
    const depthMap = new Map<string, number>();
    depthMap.set(rootDir, 0);
    let yieldCounter = 0;

    while (stack.length > 0) {
      if (this.abortScan) return;

      const currentDir = stack.pop()!;
      const depth = depthMap.get(currentDir) ?? 0;
      if (depth >= MAX_DEPTH) continue;

      let names: string[];
      try {
        names = await fs.promises.readdir(currentDir);
      } catch {
        continue;
      }

      for (let i = 0; i < names.length; i += BATCH_SIZE) {
        if (this.abortScan) return;
        if (this.indexedCount >= MAX_ENTRIES) return;

        const batch = names.slice(i, i + BATCH_SIZE);
        const stats = await Promise.all(
          batch.map(n =>
            fs.promises.stat(path.join(currentDir, n))
              .catch(() => null)
          )
        );

        for (let j = 0; j < batch.length; j++) {
          if (this.indexedCount >= MAX_ENTRIES) break;
          const stat = stats[j];
          if (!stat) continue;
          const name = batch[j];
          const fullPath = path.join(currentDir, name);

          if (stat.isDirectory() && !shouldSkipDir(name)) {
            stack.push(fullPath);
            depthMap.set(fullPath, depth + 1);
          }

          const key = name.toLowerCase();
          const entry: IndexedEntry = {
            path: fullPath,
            name,
            size: stat.size,
            mtime: stat.mtimeMs,
            isDirectory: stat.isDirectory(),
          };

          const existing = this.nameIndex.get(key);
          if (existing) existing.push(entry);
          else this.nameIndex.set(key, [entry]);
          this.pathIndex.set(fullPath, entry);
          this.indexedCount++;

          yieldCounter++;
          if (yieldCounter % YIELD_INTERVAL === 0) {
            this.progressCb?.({ indexed: this.indexedCount, estimatedTotal: 0 });
          }
        }
      }

      if (yieldCounter % (YIELD_INTERVAL * 5) === 0) {
        await yieldToEventLoop();
      }
    }
  }

  private startWatching(): void {
    const watchDirs: string[] = [];
    const home = app.getPath('home');
    if (home) watchDirs.push(home);
    try {
      const projectDir = app.getPath('documents');
      if (projectDir) watchDirs.push(projectDir);
    } catch { /* skip */ }

    if (watchDirs.length === 0) return;

    this.watcher = chokidar.watch(watchDirs, {
      ignored: [
        /(^|[\/\\])\.\w+/,
        /[\/\\]AppData[\/\\]/,
        /[\/\\]node_modules[\/\\]/,
        /[\/\\]\.git[\/\\]/,
        /\.tmp$/,
        /~\d*$/,
        /\.swp$/,
        /\.lnk$/,
        /\.cache/,
      ],
      persistent: true,
      ignoreInitial: true,
      depth: 8,
    });

    this.watcher
      .on('add', (filePath: string) => {
        const name = path.basename(filePath);
        const key = name.toLowerCase();
        fs.promises.stat(filePath).then(stat => {
          const entry: IndexedEntry = {
            path: filePath, name,
            size: stat.size, mtime: stat.mtimeMs,
            isDirectory: false,
          };
          const existing = this.nameIndex.get(key);
          if (existing) existing.push(entry);
          else this.nameIndex.set(key, [entry]);
          this.pathIndex.set(filePath, entry);
          this.indexedCount++;
          this.scheduleSave();
        }).catch(() => {});
      })
      .on('unlink', (filePath: string) => {
        const entry = this.pathIndex.get(filePath);
        if (entry) {
          const key = entry.name.toLowerCase();
          const arr = this.nameIndex.get(key);
          if (arr) {
            const filtered = arr.filter(e => e.path !== filePath);
            if (filtered.length > 0) this.nameIndex.set(key, filtered);
            else this.nameIndex.delete(key);
          }
          this.pathIndex.delete(filePath);
          this.indexedCount = Math.max(0, this.indexedCount - 1);
          this.scheduleSave();
        }
      })
      .on('change', (filePath: string) => {
        fs.promises.stat(filePath).then(stat => {
          const entry = this.pathIndex.get(filePath);
          if (entry) {
            entry.size = stat.size;
            entry.mtime = stat.mtimeMs;
          }
        }).catch(() => {});
      });
  }
}

let instance: FileIndexer | null = null;

export function getFileIndexer(): FileIndexer {
  if (!instance) instance = new FileIndexer();
  return instance;
}