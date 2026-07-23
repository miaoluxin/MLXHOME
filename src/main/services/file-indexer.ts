import fs from 'fs';
import path from 'path';
import os from 'os';
import { serialize, deserialize } from 'v8';
import { app } from 'electron';
import chokidar, { FSWatcher } from 'chokidar';
import type { SearchResult } from '../../shared/types';

// ── 内部索引条目 ──
interface IndexedEntry {
  path: string;
  name: string;
  size: number;
  mtime: number;
  isDirectory: boolean;
}

// ── 序列化快照格式 ──
interface IndexSnapshot {
  version: number;
  timestamp: number;
  entries: Array<[string, IndexedEntry[]]>;
}

const INDEX_VERSION = 2;

const MAX_ENTRIES = 300000;

// ── 跳过的系统目录 ──
const SKIP_DIRS = new Set([
  'Windows', 'Program Files', 'Program Files (x86)', 'ProgramData',
  '$Recycle.Bin', 'System Volume Information', 'Recovery',
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

export class FileIndexer {
  // ── 索引数据 ──
  private nameIndex = new Map<string, IndexedEntry[]>();
  private pathIndex = new Map<string, IndexedEntry>();
  private driveRoots: string[] = [];

  // ── 状态 ──
  private _isReady = false;
  private _isScanning = false;
  private indexedCount = 0;

  // ── 文件监听 ──
  private watcher: FSWatcher | null = null;

  // ── 持久化 ──
  private saveTimer: ReturnType<typeof setInterval> | null = null;
  private lastSaveTime = 0;

  // ── 事件回调 ──
  private progressCb: ((data: { indexed: number; estimatedTotal: number }) => void) | null = null;
  private readyCb: (() => void) | null = null;
  private errorCb: ((err: string) => void) | null = null;

  // ── 公共访问器 ──
  get isReady() { return this._isReady; }
  get isScanning() { return this._isScanning; }

  // ── 事件注册 ──
  onProgress(cb: (data: { indexed: number; estimatedTotal: number }) => void) { this.progressCb = cb; }
  onReady(cb: () => void) { this.readyCb = cb; }
  onError(cb: (err: string) => void) { this.errorCb = cb; }

  private get indexPath(): string {
    return path.join(app.getPath('userData'), 'mlx-file-index.dat');
  }

  // ═══════════════════════════════════════
  //  启动
  // ═══════════════════════════════════════
  async start(roots?: string[]): Promise<void> {
    // 1) 尝试从磁盘加载缓存
    if (this.loadIndex()) {
      this._isReady = true;
      this.readyCb?.();
      this.startWatching();
      this.startBackgroundRefresh();
      return;
    }

    // 2) 无缓存 → 扫描指定目录，未指定时只扫家目录
    this.driveRoots = roots && roots.length > 0 ? roots : [];
    if (this.driveRoots.length === 0) {
      const home = process.env.USERPROFILE || os.homedir();
      if (home) this.driveRoots = [home];
    }
    await this.fullScan();
  }

  // ═══════════════════════════════════════
  //  搜索（同步，毫秒级）
  // ═══════════════════════════════════════
  search(query: string, maxResults = 500): SearchResult[] {
    if (!query || !query.trim()) return [];
    if (!this._isReady && !this._isScanning) return [];

    const lower = query.trim().toLowerCase();
    const scored: Array<{
      result: SearchResult;
      mtime: number;
      score: number; // 0=精确 1=前缀 2=子串
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

    // 排序：分数优先 → 时间优先
    scored.sort((a, b) => {
      if (a.score !== b.score) return a.score - b.score;
      return b.mtime - a.mtime;
    });

    return scored.slice(0, maxResults).map(r => r.result);
  }

  // ═══════════════════════════════════════
  //  状态
  // ═══════════════════════════════════════
  getStatus() {
    return {
      isReady: this._isReady,
      isScanning: this._isScanning,
      indexedCount: this.indexedCount,
    };
  }

  async reindex(): Promise<void> {
    this.stop();
    this.nameIndex.clear();
    this.pathIndex.clear();
    this.indexedCount = 0;
    this._isReady = false;
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
    this.saveIndex(); // 关闭前保存
  }

  // ═══════════════════════════════════════
  //  索引持久化
  // ═══════════════════════════════════════
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
      this.driveRoots = this.listDrives();
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

  // ═══════════════════════════════════════
  //  全量扫描
  // ═══════════════════════════════════════
  private async fullScan(): Promise<void> {
    this._isScanning = true;
    this.nameIndex.clear();
    this.pathIndex.clear();
    this.indexedCount = 0;
    this.driveRoots = this.listDrives();

    // 每 30s 自动保存检查点
    this.saveTimer = setInterval(() => this.saveIndex(), 30000);

    try {
      for (const drive of this.driveRoots) {
        await this.scanDirectory(drive);
      }

      this._isReady = true;
      this.saveIndex();
      this.startWatching();
      this.readyCb?.();
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
    const MAX_DEPTH = 15;
    const BATCH_SIZE = 50;

    while (stack.length > 0) {
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
        }

        if (this.indexedCount >= MAX_ENTRIES) break;

        if (this.indexedCount % 1000 < BATCH_SIZE) {
          this.progressCb?.({ indexed: this.indexedCount, estimatedTotal: 0 });
        }
      }
    }
  }

  // ═══════════════════════════════════════
  //  后台刷新（加载缓存后，增量检测变更）
  // ═══════════════════════════════════════
  private async startBackgroundRefresh(): Promise<void> {
    // 快速检查上次序列化之后是否有变化（只检查根目录修改时间）
    for (const drive of this.driveRoots) {
      try {
        const stat = await fs.promises.stat(drive);
        // 如果驱动器根目录的修改时间晚于索引保存时间 → 可能有新增/删除文件
        // 这种情况下简单做一个目录级深度扫描（只查顶层变化）
      } catch { /* skip */ }
    }
  }

  // ═══════════════════════════════════════
  //  文件监听（chokidar）
  // ═══════════════════════════════════════
  private startWatching(): void {
    // 只监听用户目录和项目常见位置，不监听系统盘根目录
    const watchDirs: string[] = [];

    // 用户主目录
    const home = app.getPath('home');
    if (home) {
      watchDirs.push(home);
    }

    // 项目目录
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

  // ═══════════════════════════════════════
  //  工具方法
  // ═══════════════════════════════════════
  private listDrives(): string[] {
    const drives: string[] = [];
    for (let i = 65; i <= 90; i++) {
      const letter = String.fromCharCode(i);
      const p = `${letter}:\\`;
      try {
        fs.accessSync(p, fs.constants.F_OK);
        drives.push(p);
      } catch { /* skip */ }
    }
    return drives;
  }
}

// ── 单例 ──
let instance: FileIndexer | null = null;

export function getFileIndexer(): FileIndexer {
  if (!instance) instance = new FileIndexer();
  return instance;
}
