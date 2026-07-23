import { useState, useEffect, useRef, useCallback } from 'react';
import {
  VscSearch, VscClose, VscFile, VscFolder, VscFolderOpened,
  VscFileCode, VscFileMedia, VscFilePdf, VscFileZip,
  VscSymbolFile, VscLoading, VscCopy, VscEdit, VscSettingsGear,
} from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { useFileStore } from '../../stores/useFileStore';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { useFileClipboardStore } from '../../stores/useFileClipboardStore';
import type { SearchResult, IndexStatus } from '../../../shared/types';
import { IndexSettings } from '../search/IndexSettings';
import { useIndexSettingsStore } from '../../stores/useIndexSettingsStore';

// ── 文件类型 → 图标映射 ──
function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return <VscFolder size={15} className="text-yellow-500 flex-shrink-0" />;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  switch (ext) {
    case 'pdf': return <VscFilePdf size={15} className="text-red-400 flex-shrink-0" />;
    case 'zip': case 'rar': case '7z': case 'tar': case 'gz':
      return <VscFileZip size={15} className="text-orange-400 flex-shrink-0" />;
    case 'png': case 'jpg': case 'jpeg': case 'gif': case 'bmp': case 'webp': case 'svg':
    case 'ico': case 'mp4': case 'mp3': case 'wav': case 'avi': case 'mkv':
      return <VscFileMedia size={15} className="text-purple-400 flex-shrink-0" />;
    case 'js': case 'ts': case 'jsx': case 'tsx': case 'py': case 'java': case 'c': case 'cpp':
    case 'rs': case 'go': case 'rb': case 'php': case 'html': case 'css': case 'json': case 'xml':
      return <VscFileCode size={15} className="text-blue-400 flex-shrink-0" />;
    case 'exe': case 'msi': case 'bat': case 'cmd': case 'ps1':
      return <VscSymbolFile size={15} className="text-green-400 flex-shrink-0" />;
    default: return <VscFile size={15} className="text-text-secondary flex-shrink-0" />;
  }
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

let searchTimer: ReturnType<typeof setTimeout> | null = null;

export function EverythingSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [hasSearched, setHasSearched] = useState(false);
  const [isIndexReady, setIsIndexReady] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [indexLoading, setIndexLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const toggleEverythingSearch = useLayoutStore((s) => s.toggleEverythingSearch);
  const setCurrentPath = useFileStore((s) => s.setCurrentPath);

  // Feature #3: 右键菜单状态
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; result: SearchResult
  } | null>(null);

  // ── 索引状态监听 ──
  useEffect(() => {
    let unsubProgress: (() => void) | null = null;
    let unsubReady: (() => void) | null = null;

    async function init() {
      try {
        const status = await window.electronAPI.fileIndexer.getStatus();
        setIsIndexReady(status.isReady);
        setIsScanning(status.isScanning);
        setIndexedCount(status.indexedCount);
        if (status.isReady) { inputRef.current?.focus(); }
        if (!status.isReady && !status.isScanning) {
          window.electronAPI.fileIndexer.start();
        }
      } catch (err) {
        console.error('[EverythingSearch] 获取索引状态失败:', err);
        setIsIndexReady(false);
        setIsScanning(false);
      } finally {
        setIndexLoading(false);
      }

      try {
        unsubProgress = window.electronAPI.fileIndexer.onProgress((data) => {
          setIndexedCount(data.indexed);
          setIsScanning(true);
        });
      } catch { /* ignore */ }

      try {
        unsubReady = window.electronAPI.fileIndexer.onReady(() => {
          setIsIndexReady(true);
          setIsScanning(false);
          inputRef.current?.focus();
        });
      } catch { /* ignore */ }
    }

    init();
    return () => {
      if (searchTimer) clearTimeout(searchTimer);
      unsubProgress?.();
      unsubReady?.();
    };
  }, []);

  const handleSearch = useCallback((q: string) => {
    if (searchTimer) clearTimeout(searchTimer);
    if (q.length < 2) {
      setResults([]);
      setHasSearched(false);
      setSelectedIdx(-1);
      return;
    }

    searchTimer = setTimeout(async () => {
      setHasSearched(true);
      try {
        const res = await window.electronAPI.fileIndexer.search(q);
        setResults(res);
        setSelectedIdx(res.length > 0 ? 0 : -1);
      } catch {
        setResults([]);
      }
    }, 300);
  }, []);

  // Feature #4: 搜索结果始终用系统默认程序打开
  const openResult = useCallback(async (result: SearchResult) => {
    if (result.isDirectory) {
      setCurrentPath(result.path);
      useLayoutStore.getState().setShowFileBrowser(true);
    } else {
      try {
        await window.electronAPI.fs.openFile(result.path);
      } catch {
        const dir = result.path.substring(0, Math.max(
          result.path.lastIndexOf('/'), result.path.lastIndexOf('\\')
        ));
        setCurrentPath(dir);
        useLayoutStore.getState().setShowFileBrowser(true);
      }
    }
  }, [setCurrentPath]);

  // Feature #3: 右键菜单
  const handleContextMenu = useCallback((e: React.MouseEvent, result: SearchResult) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, result });
  }, []);

  const handleShowInFolder = async (filePath: string) => {
    try {
      await window.electronAPI.fs.showInFolder(filePath);
    } catch { /* ignore */ }
  };

  const handleCopyPath = async (path: string) => {
    try {
      await navigator.clipboard.writeText(path);
    } catch { /* ignore */ }
  };

  const handleCopyFile = (path: string) => {
    useFileClipboardStore.getState().setClipboard([path], 'copy');
  };

  const handleCutFile = (path: string) => {
    useFileClipboardStore.getState().setClipboard([path], 'cut');
  };

  const handleRename = async (oldPath: string) => {
    const oldName = oldPath.split('/').pop() || oldPath.split('\\').pop() || '';
    const newName = prompt('重命名:', oldName);
    if (!newName || newName === oldName) return;
    const parentDir = oldPath.replace(/\\/g, '/').substring(0, oldPath.replace(/\\/g, '/').lastIndexOf('/'));
    const newPath = parentDir + '/' + newName.trim();
    try {
      await window.electronAPI.fs.rename(oldPath, newPath);
      handleSearch(query);
    } catch (err) {
      alert('重命名失败，可能目标已存在或无权限');
    }
  };

  const buildContextMenuItems = (result: SearchResult): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      {
        label: '打开文件所在文件夹',
        icon: <VscFolderOpened size={14} />,
        onClick: () => handleShowInFolder(result.path),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '复制文件路径',
        icon: <VscCopy size={14} />,
        onClick: () => handleCopyPath(result.path),
      },
      {
        label: '复制',
        icon: <VscCopy size={14} />,
        onClick: () => handleCopyFile(result.path),
      },
      {
        label: '剪切',
        icon: <VscCopy size={14} />,
        onClick: () => handleCutFile(result.path),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '重命名', icon: <VscEdit size={14} />,
        onClick: () => handleRename(result.path),
      },
    ];

    // 粘贴：仅在文件浏览器打开时可用
    const clipboard = useFileClipboardStore.getState();
    if (clipboard.hasEntries && useLayoutStore.getState().showFileBrowser) {
      const currentDir = useFileStore.getState().currentPath;
      items.push(
        { divider: true, label: '', onClick: () => {} },
        {
          label: '粘贴到当前文件夹',
          icon: <VscFile size={14} />,
          onClick: async () => {
            const cb = useFileClipboardStore.getState();
            for (const srcPath of cb.paths) {
              const name = srcPath.split('/').pop() || srcPath.split('\\').pop() || 'pasted';
              const destPath = currentDir.replace(/\\/g, '/') + '/' + name;
              try {
                if (cb.operation === 'cut') {
                  await window.electronAPI.fs.rename(srcPath, destPath);
                } else {
                  await window.electronAPI.fs.copyFile(srcPath, destPath);
                }
              } catch { /* ignore */ }
            }
            if (cb.operation === 'cut') cb.clearClipboard();
          },
        }
      );
    }

    return items;
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (results.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIdx((prev) => { const next = prev < results.length - 1 ? prev + 1 : prev; scrollToItem(next); return next; });
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIdx((prev) => { const next = prev > 0 ? prev - 1 : 0; scrollToItem(next); return next; });
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIdx >= 0 && selectedIdx < results.length) {
          openResult(results[selectedIdx]);
        }
        break;
      case 'Escape':
        setQuery('');
        setResults([]);
        setHasSearched(false);
        setSelectedIdx(-1);
        break;
    }
  }, [results, selectedIdx, openResult]);

  const scrollToItem = (idx: number) => {
    const container = resultsRef.current;
    if (!container) return;
    const items = container.children;
    if (items[idx]) { items[idx].scrollIntoView({ block: 'nearest' }); }
  };

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      {/* ── 标题栏 ── */}
      <DraggablePanelHeader panelId="everythingSearch" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle">
        <div className="flex items-center gap-2">
          <VscSearch size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">文件搜索</span>
        </div>
        <button
          onClick={toggleEverythingSearch}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors"
          title="关闭文件搜索"
        >
          <VscClose size={16} />
        </button>
      </DraggablePanelHeader>

      {/* ── 搜索输入框 ── */}
      <div className="px-3 py-2 border-b border-border-subtle">
        <div className="relative">
          <VscSearch size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); handleSearch(e.target.value); }}
            onKeyDown={handleKeyDown}
            placeholder={isIndexReady ? "搜索文件名... (至少2字符)" : "索引加载中..."}
            disabled={indexLoading}
            className="w-full bg-bg-raised border border-border-subtle rounded-md pl-8 pr-16 py-1.5
              text-xs text-text-primary placeholder-text-tertiary outline-none
              focus:border-accent transition-colors
              disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
            <button onClick={() => setShowSettings(true)}
              className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors" title="索引设置">
              <VscSettingsGear size={12} />
            </button>
            {query && (
              <button
                onClick={() => { setQuery(''); setResults([]); setHasSearched(false); setSelectedIdx(-1); inputRef.current?.focus(); }}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-bg-hover text-text-tertiary hover:text-text-primary transition-colors"
              >
                <VscClose size={12} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── 索引状态栏 ── */}
      <div className="px-3 py-1.5 border-b border-border-subtle bg-bg-deep">
        <div className="flex items-center gap-2 text-[10px] text-text-tertiary">
          {indexLoading ? (
            <span className="flex items-center gap-1">
              <VscLoading size={11} className="animate-spin" />
              加载索引中...
            </span>
          ) : isScanning ? (
            <span className="flex items-center gap-1">
              <VscLoading size={11} className="animate-spin" />
              正在索引 {indexedCount > 0 ? `${indexedCount.toLocaleString()} 个文件...` : '...'}
            </span>
          ) : isIndexReady ? (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
              已索引 {indexedCount.toLocaleString()} 个文件
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-500" />
              索引未就绪
            </span>
          )}
        </div>
      </div>

      {/* ── 搜索结果 ── */}
      <div ref={resultsRef} className="flex-1 overflow-y-auto">
        {!isIndexReady && !isScanning && !indexLoading && (
          <div className="flex flex-col items-center justify-center py-8 text-text-tertiary text-xs gap-2">
            <span>索引尚未就绪</span>
            <button
              onClick={() => window.electronAPI.fileIndexer.start()}
              className="px-3 py-1 bg-accent/10 text-accent rounded-md hover:bg-accent/20 transition-colors"
            >
              开始索引
            </button>
          </div>
        )}

        {isScanning && !hasSearched && (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">
            索引完成后即可搜索
          </div>
        )}

        {hasSearched && results.length === 0 && !isScanning && (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">
            未找到匹配的文件
          </div>
        )}

        {hasSearched && results.length === 0 && isScanning && (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">
            扫描中未找到，索引完成后可再次搜索
          </div>
        )}

        {results.map((result, idx) => (
          <div
            key={`${result.path}-${idx}`}
            onClick={() => { setSelectedIdx(idx); openResult(result); }}
            onDoubleClick={() => { setSelectedIdx(idx); openResult(result); }}
            onContextMenu={(e) => handleContextMenu(e, result)}
            className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors border-b border-border-subtle
              ${idx === selectedIdx
                ? 'bg-accent/15 border-l-2 border-l-accent'
                : 'hover:bg-bg-hover border-l-2 border-l-transparent'
              }`}
          >
            {getFileIcon(result.name, result.isDirectory)}

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-primary truncate font-medium">
                  {result.name}
                </span>
                {result.size > 0 && (
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">
                    {formatSize(result.size)}
                  </span>
                )}
                {result.isDirectory && (
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">目录</span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-text-tertiary truncate flex-1">
                  {result.path}
                </span>
                {result.modified && (
                  <span className="text-[10px] text-text-tertiary flex-shrink-0">
                    {result.modified}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}

        {!hasSearched && isIndexReady && (
          <div className="flex items-center justify-center py-8 text-text-tertiary text-xs">
            输入文件名开始搜索
          </div>
        )}
      </div>

      {/* ── 状态栏 ── */}
      {hasSearched && results.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-border-subtle bg-bg-deep text-[10px] text-text-tertiary">
          <span>共 {results.length} 条结果</span>
          <span>快速索引引擎</span>
        </div>
      )}

      {/* Feature #3: 右键菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildContextMenuItems(contextMenu.result)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 索引设置面板 */}
      {showSettings && (
        <IndexSettings onClose={() => setShowSettings(false)} />
      )}
    </div>
  );
}
