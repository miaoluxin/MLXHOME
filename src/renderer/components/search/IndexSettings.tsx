import { useState, useEffect, useCallback } from 'react';
import { VscClose, VscFolder, VscFolderOpened, VscRefresh } from 'react-icons/vsc';
import { useIndexSettingsStore } from '../../stores/useIndexSettingsStore';

interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
}

interface Props {
  onClose: () => void;
}

// 判断 pathA 是否是 pathB 的祖先目录
function isAncestorOrSelf(parent: string, child: string): boolean {
  const a = parent.replace(/\\/g, '/').replace(/\/$/, '');
  const b = child.replace(/\\/g, '/').replace(/\/$/, '');
  if (b === a) return true;
  return b.startsWith(a + '/');
}

export function IndexSettings({ onClose }: Props) {
  const { roots, setRoots } = useIndexSettingsStore();
  const [drives, setDrives] = useState<DirEntry[]>([]);
  const [children, setChildren] = useState<Map<string, DirEntry[]>>(new Map());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reindexing, setReindexing] = useState(false);

  useEffect(() => {
    window.electronAPI.fs.listDrives().then((list: string[]) => {
      setDrives(list.map(d => ({ name: d, path: d, isDirectory: true })));
    });
    setSelected(new Set(roots));
  }, []);

  const isSelected = useCallback((path: string) => {
    for (const r of selected) {
      if (isAncestorOrSelf(r, path)) return true;
    }
    return false;
  }, [selected]);

  const toggleDir = async (dirPath: string) => {
    const next = new Set(expanded);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
      if (!children.has(dirPath)) {
        try {
          const list = await window.electronAPI.fs.list(dirPath);
          setChildren(prev => new Map(prev).set(dirPath, list.filter(e => e.isDirectory)));
        } catch { /* ignore */ }
      }
    }
    setExpanded(next);
  };

  // 递归展开并收集 path 下的所有子目录（用于选中/取消时连带操作）
  const collectDescendants = async (dirPath: string): Promise<string[]> => {
    const result: string[] = [dirPath];
    try {
      const list = await window.electronAPI.fs.list(dirPath);
      const subdirs = list.filter(e => e.isDirectory);
      for (const sub of subdirs) {
        const deeper = await collectDescendants(sub.path);
        result.push(...deeper);
      }
      // 缓存 children
      setChildren(prev => {
        if (prev.has(dirPath)) return prev;
        const next = new Map(prev);
        next.set(dirPath, subdirs);
        return next;
      });
    } catch { /* ignore */ }
    return result;
  };

  const toggleSelect = async (path: string) => {
    const next = new Set(selected);
    if (next.has(path)) {
      // 取消选中：同时删除所有子孙目录
      const toRemove: string[] = [];
      for (const s of next) {
        if (isAncestorOrSelf(path, s)) toRemove.push(s);
      }
      toRemove.forEach(s => next.delete(s));
    } else {
      // 选中：添加该目录及所有子孙目录
      const descendants = await collectDescendants(path);
      descendants.forEach(d => next.add(d));
    }
    setSelected(next);
  };

  const handleSave = async () => {
    const newRoots = Array.from(selected);
    setRoots(newRoots);
    onClose();
    // 触发重建索引（传递新 roots），不等待完成
    window.electronAPI.fileIndexer.reindex(newRoots).catch((err: any) => {
      console.error('[IndexSettings] 重建索引失败:', err);
    });
  };

  const renderTree = (items: DirEntry[], depth: number) => {
    return items.map(entry => {
      const isExpanded = expanded.has(entry.path);
      const childDirs = children.get(entry.path) || [];
      const checked = isSelected(entry.path);
      const normalSelected = selected.has(entry.path);
      const partiallyChecked = checked && !normalSelected;

      return (
        <div key={entry.path}>
          <div
            className="flex items-center gap-1.5 px-2 py-1 cursor-pointer hover:bg-bg-hover rounded text-xs"
            style={{ paddingLeft: 8 + depth * 20 }}
          >
            <input type="checkbox" checked={checked}
              ref={(el) => { if (el) el.indeterminate = partiallyChecked; }}
              onChange={() => toggleSelect(entry.path)}
              className="accent-accent flex-shrink-0" />
            <span className="flex-shrink-0 cursor-pointer" onClick={() => toggleDir(entry.path)}>
              {isExpanded ? <VscFolderOpened size={14} className="text-yellow-500" />
                : <VscFolder size={14} className={depth === 0 ? 'text-blue-400' : 'text-yellow-500'} />}
            </span>
            <span className="flex-1 truncate text-text-primary" onClick={() => toggleDir(entry.path)}>
              {entry.name}
            </span>
          </div>
          {isExpanded && childDirs.length > 0 && renderTree(childDirs, depth + 1)}
        </div>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-bg-raised border border-border-subtle rounded-xl shadow-2xl w-[500px] max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
          <span className="text-sm font-medium text-text-primary">文件索引设置</span>
          <button onClick={onClose} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary">
            <VscClose size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="text-[10px] text-text-tertiary mb-2 px-2">勾选要索引的目录（展开后可选子目录，选中父目录自动连带子目录）</div>
          {drives.length === 0 ? (
            <div className="text-xs text-text-tertiary text-center py-4">加载中...</div>
          ) : (
            renderTree(drives, 0)
          )}
        </div>

        <div className="flex items-center justify-between px-4 py-3 border-t border-border-subtle bg-bg-deep">
          <span className="text-[10px] text-text-tertiary">已选 {selected.size} 个目录</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors">取消</button>
            <button onClick={handleSave} disabled={reindexing}
              className="px-4 py-1.5 text-xs bg-accent text-white rounded hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-wait flex items-center gap-1">
              {reindexing && <VscRefresh size={12} className="animate-spin" />}
              应用{reindexing ? '中...' : ''}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
