import { VscNewFile, VscNewFolder, VscEdit, VscTrash, VscCopy, VscFolderOpened, VscFile, VscRefresh } from 'react-icons/vsc';
import { useState, useEffect, useCallback, useRef, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileRow } from './FileRow';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { NewFileTypePicker, FILE_TYPES } from './NewFileTypePicker';
import { useFileStore } from '../../stores/useFileStore';
import { useEditorStore } from '../../stores/useEditorStore';
import { useFileClipboardStore } from '../../stores/useFileClipboardStore';
import type { FileEntry } from '../../../shared/types';

interface Props {
  rootPath: string;
}

const BINARY_EXTENSIONS = new Set([
  '.exe', '.dll', '.so', '.dylib', '.bin', '.sys', '.msi',
  '.class', '.pyc', '.pyo', '.o', '.obj', '.wasm', '.node', '.pdb', '.ilk',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.icns', '.webp', '.tiff', '.tif', '.heic',
  '.mp3', '.mp4', '.wav', '.flac', '.aac', '.ogg', '.avi', '.mkv', '.mov', '.wmv', '.webm',
  '.zip', '.tar', '.gz', '.xz', '.bz2', '.7z', '.rar', '.zst', '.br',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
  '.ttf', '.otf', '.woff', '.woff2', '.eot',
  '.db', '.sqlite', '.sqlite3', '.mdb', '.accdb',
  '.iso', '.dmg', '.vdi', '.vmdk', '.qcow2',
]);

function isBinaryContent(buffer: string): boolean {
  const sample = buffer.slice(0, 512);
  return sample.includes('\x00');
}

function canOpenAsText(entry: FileEntry): boolean {
  if (entry.isDirectory) return false;
  if (entry.size > 10 * 1024 * 1024) return false;
  if (BINARY_EXTENSIONS.has(entry.extension)) return false;
  return true;
}

interface FileRowWrapperProps {
  entry: FileEntry;
  depth: number;
  isExpanded: boolean;
  childrenEntries: FileEntry[];
  isSelected: boolean;
  editing: boolean;
  handleRenameCommit: (oldPath: string, newName: string) => Promise<void>;
  handleRenameCancel: () => void;
  handleClick: (entry: FileEntry) => void;
  handleDoubleClick: (entry: FileEntry) => Promise<void>;
  handleContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  renderEntry: (entry: FileEntry, depth: number) => React.ReactNode;
}

const FileRowWrapper = memo(function FileRowWrapper({
  entry, depth, isExpanded, childrenEntries, isSelected, editing,
  handleRenameCommit, handleRenameCancel, handleClick, handleDoubleClick,
  handleContextMenu, renderEntry,
}: FileRowWrapperProps) {
  const onRenameCommit = useCallback((newName: string) => {
    handleRenameCommit(entry.path, newName);
  }, [entry.path, handleRenameCommit]);
  const onClick = useCallback(() => handleClick(entry), [entry, handleClick]);
  const onDoubleClick = useCallback(() => handleDoubleClick(entry), [entry, handleDoubleClick]);
  const onContextMenu = useCallback((e: React.MouseEvent) => handleContextMenu(e, entry), [entry, handleContextMenu]);

  return (
    <div>
      <div style={{ paddingLeft: depth * 16 }}>
        <FileRow
          entry={entry}
          isSelected={isSelected}
          editing={editing}
          onRenameCommit={onRenameCommit}
          onRenameCancel={handleRenameCancel}
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          onContextMenu={onContextMenu}
        />
      </div>
      <AnimatePresence>
        {entry.isDirectory && isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ overflow: 'hidden' }}
          >
            {childrenEntries.map((child) => renderEntry(child, depth + 1))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

export function FileTree({ rootPath }: Props) {
  const { currentPath, entries, selectedPath, setCurrentPath, setEntries, setLoading, setSelectedPath, refreshTrigger, triggerRefresh } =
    useFileStore();
  const openFile = useEditorStore((s) => s.openFile);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [childEntries, setChildEntries] = useState<Map<string, FileEntry[]>>(new Map());
  const [openError, setOpenError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; entry: FileEntry
  } | null>(null);
  // Feature #2: 行内重命名 & 新建文件类型选择
  const [editingPath, setEditingPath] = useState<string | null>(null);
  const [showTypePicker, setShowTypePicker] = useState<{ x: number; y: number; parentDir: string } | null>(null);
  const [emptyContextMenu, setEmptyContextMenu] = useState<{ x: number; y: number } | null>(null);

  const lastClickRef = useRef<{ path: string; time: number } | null>(null);

  const loadDir = useCallback(async (dirPath: string) => {
    setLoading(true);
    try {
      const list = await window.electronAPI.fs.list(dirPath);
      setEntries(list);
      setCurrentPath(dirPath);
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (rootPath) {
      loadDir(rootPath);
      setExpandedDirs(new Set());
      setChildEntries(new Map());
    }
  }, [rootPath, refreshTrigger]);

  // 文件系统变更自动刷新（外部工具/CLI 生成文件后自动更新文件树）
  useEffect(() => {
    if (!rootPath) return;

    let debounceTimer: number;

    // 通知主进程开始监听当前目录
    window.electronAPI.fs.startWatch(rootPath).catch(console.error);

    // 订阅文件变更事件
    const unsubscribe = window.electronAPI.fs.onChange((_eventType, _filePath) => {
      clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        // 从 store 读取最新路径，避免闭包中捕获过时的 currentPath
        const latestPath = useFileStore.getState().currentPath || rootPath;
        loadDir(latestPath);
      }, 500);
    });

    return () => {
      unsubscribe();
      clearTimeout(debounceTimer);
    };
  }, [rootPath]);

  const toggleExpand = async (entry: FileEntry) => {
    if (!entry.isDirectory) return;
    const key = entry.path;
    const next = new Set(expandedDirs);
    if (next.has(key)) {
      next.delete(key);
      setExpandedDirs(next);
    } else {
      next.add(key);
      setExpandedDirs(next);
      if (!childEntries.has(key)) {
        try {
          const list = await window.electronAPI.fs.list(key);
          setChildEntries((prev) => new Map(prev).set(key, list));
        } catch { /* skip */ }
      }
    }
  };

  // ── Feature #2: 新建文件（通过类型选择器）──
  const handleNewFile = (parentDir: string, x: number, y: number) => {
    setShowTypePicker({ x, y, parentDir });
  };

  const handleFileTypeSelected = useCallback(async (ext: string) => {
    if (!showTypePicker) return;
    const { parentDir } = showTypePicker;
    setShowTypePicker(null);
    const baseName = 'untitled';
    const fileName = baseName + ext;
    const filePath = parentDir.replace(/\\/g, '/') + '/' + fileName;
    try {
      await window.electronAPI.fs.write(filePath, '');
      await loadDir(currentPath);
      // 进入行内重命名模式
      setEditingPath(filePath);
      setSelectedPath(filePath);
    } catch (err) {
      console.error('[FileTree] 新建文件失败:', err);
    }
  }, [showTypePicker, currentPath, loadDir, setSelectedPath]);

  // ── Feature #2: 行内重命名提交 ──
  const handleRenameCommit = useCallback(async (oldPath: string, newName: string) => {
    setEditingPath(null);
    if (!newName || newName.trim() === '') return;
    const normalized = oldPath.replace(/\\/g, '/');
    const parentDir = normalized.substring(0, normalized.lastIndexOf('/'));
    const newPath = parentDir + '/' + newName.trim();
    if (newPath === normalized) return;
    try {
      await window.electronAPI.fs.rename(oldPath, newPath);
      // 如果文件在编辑器中打开，更新路径
      const editor = useEditorStore.getState();
      const openFile = editor.openFiles.find((f) => f.path === oldPath);
      if (openFile) {
        editor.saveAsFile(openFile.id, newPath, openFile.content);
      }
      loadDir(currentPath);
      setSelectedPath(newPath);
    } catch (err) {
      console.error('[FileTree] 重命名失败:', err);
      alert('重命名失败，可能目标名称已存在或无权操作');
    }
  }, [currentPath, loadDir, setSelectedPath]);

  const handleRenameCancel = useCallback(() => {
    setEditingPath(null);
  }, []);

  const handleNewFolder = async (parentDir: string) => {
    const name = prompt('请输入文件夹名:');
    if (!name) return;
    try {
      await window.electronAPI.fs.createDir(parentDir, name);
      loadDir(currentPath);
    } catch (err) {
      console.error('[FileTree] 新建文件夹失败:', err);
    }
  };

  const handleRename = async (oldPath: string) => {
    // 直接进入行内重命名
    setEditingPath(oldPath);
  };

  const handleDelete = async (targetPath: string) => {
    const name = targetPath.split('/').pop() || targetPath.split('\\').pop() || '';
    const confirmed = window.confirm(`确定要删除 "${name}" 吗？\n此操作不可撤销。`);
    if (!confirmed) return;
    try {
      const editor = useEditorStore.getState();
      const openFile = editor.openFiles.find((f) => f.path === targetPath);
      if (openFile) {
        editor.closeFile(openFile.id);
      }
      await window.electronAPI.fs.delete(targetPath);
      loadDir(currentPath);
    } catch (err) {
      console.error('[FileTree] 删除失败:', err);
      alert('删除失败');
    }
  };

  const handleCopyPath = async (targetPath: string) => {
    try {
      await navigator.clipboard.writeText(targetPath);
    } catch (err) {
      console.error('[FileTree] 复制路径失败:', err);
    }
  };

  // ── Feature #4: 在资源管理器中打开 ──
  const handleShowInFolder = async (targetPath: string) => {
    try {
      await window.electronAPI.fs.showInFolder(targetPath);
    } catch (err) {
      console.error('[FileTree] 打开所在文件夹失败:', err);
    }
  };

  // ── Feature #4: 文件剪贴板操作 ──
  const handleCopyFile = (targetPath: string) => {
    useFileClipboardStore.getState().setClipboard([targetPath], 'copy');
  };

  const handleCutFile = (targetPath: string) => {
    useFileClipboardStore.getState().setClipboard([targetPath], 'cut');
  };

  const handlePasteFile = async (targetDir: string) => {
    const clipboard = useFileClipboardStore.getState();
    if (!clipboard.hasEntries) return;

    for (const srcPath of clipboard.paths) {
      const name = srcPath.split('/').pop() || srcPath.split('\\').pop() || 'pasted';
      const destPath = targetDir.replace(/\\/g, '/') + '/' + name;

      try {
        if (clipboard.operation === 'cut') {
          await window.electronAPI.fs.rename(srcPath, destPath);
        } else {
          await window.electronAPI.fs.copyFile(srcPath, destPath);
        }
      } catch (err) {
        console.error('[FileTree] 粘贴失败:', err);
        alert(`粘贴 "${name}" 失败`);
        break;
      }
    }

    if (clipboard.operation === 'cut') {
      clipboard.clearClipboard();
    }
    loadDir(currentPath);
  };

  const handleClick = (entry: FileEntry) => {
    const now = Date.now();
    const last = lastClickRef.current;

    if (selectedPath === entry.path && last && last.path === entry.path && (now - last.time) > 300 && (now - last.time) < 3000) {
      setEditingPath(entry.path);
      lastClickRef.current = null;
      return;
    }

    lastClickRef.current = { path: entry.path, time: now };
    setSelectedPath(entry.path);
    if (entry.isDirectory) {
      toggleExpand(entry);
    }
  };

  const handleDoubleClick = async (entry: FileEntry) => {
    if (entry.isDirectory) {
      await loadDir(entry.path);
    } else if (canOpenAsText(entry)) {
      try {
        const content = await window.electronAPI.fs.read(entry.path);
        if (isBinaryContent(content)) {
          // Feature #4: 二进制内容用系统默认程序打开
          await window.electronAPI.fs.openFile(entry.path);
          return;
        }
        openFile(entry.path, content);
        setOpenError(null);
      } catch (err: any) {
        const reason = err?.message || '未知错误';
        console.error('[FileTree] 读取失败:', entry.name, reason);
        setOpenError(`无法打开: ${entry.name}（${reason}）`);
        setTimeout(() => setOpenError(null), 4000);
      }
    } else {
      // Feature #4: 不支持预览的文件用系统默认程序打开
      try {
        await window.electronAPI.fs.openFile(entry.path);
      } catch (err) {
        setOpenError(`无法打开: ${entry.name}`);
        setTimeout(() => setOpenError(null), 3000);
      }
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setEmptyContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!selectedPath) return;
    if (e.key === 'F2') {
      e.preventDefault();
      setEditingPath(selectedPath);
    } else if (e.key === 'Delete') {
      e.preventDefault();
      handleDelete(selectedPath);
    }
  };

  const buildMenuItems = (entry: FileEntry): ContextMenuItem[] => {
    const clipboard = useFileClipboardStore.getState();
    if (entry.isDirectory) {
      return [
        {
          label: '新建文件', icon: <VscNewFile size={14} />,
          onClick: () => handleNewFile(entry.path, contextMenu?.x ?? 0, contextMenu?.y ?? 0),
        },
        {
          label: '新建文件夹', icon: <VscNewFolder size={14} />,
          onClick: () => handleNewFolder(entry.path),
        },
        { divider: true, label: '', onClick: () => {} },
        {
          label: '重命名', icon: <VscEdit size={14} />,
          onClick: () => handleRename(entry.path),
        },
        {
          label: '删除', icon: <VscTrash size={14} />,
          onClick: () => handleDelete(entry.path),
        },
        { divider: true, label: '', onClick: () => {} },
        {
          label: '复制', icon: <VscCopy size={14} />,
          onClick: () => handleCopyFile(entry.path),
        },
        {
          label: '剪切', icon: <VscCopy size={14} />,
          onClick: () => handleCutFile(entry.path),
        },
        ...(clipboard.hasEntries ? [{
          label: '粘贴', icon: <VscFile size={14} />,
          onClick: () => handlePasteFile(entry.path),
        }] : []),
        { divider: true, label: '', onClick: () => {} },
        {
          label: '打开所在文件夹', icon: <VscFolderOpened size={14} />,
          onClick: () => handleShowInFolder(entry.path),
        },
        {
          label: '复制路径', icon: <VscCopy size={14} />,
          onClick: () => handleCopyPath(entry.path),
        },
      ];
    }
    return [
      {
        label: '打开所在文件夹', icon: <VscFolderOpened size={14} />,
        onClick: () => handleShowInFolder(entry.path),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '复制', icon: <VscCopy size={14} />,
        onClick: () => handleCopyFile(entry.path),
      },
      {
        label: '剪切', icon: <VscCopy size={14} />,
        onClick: () => handleCutFile(entry.path),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '重命名', icon: <VscEdit size={14} />,
        onClick: () => handleRename(entry.path),
      },
      {
        label: '删除', icon: <VscTrash size={14} />,
        onClick: () => handleDelete(entry.path),
      },
      { divider: true, label: '', onClick: () => {} },
      {
        label: '复制路径', icon: <VscCopy size={14} />,
        onClick: () => handleCopyPath(entry.path),
      },
    ];
  };

  const renderEntry = (entry: FileEntry, depth: number) => {
    const isExpanded = expandedDirs.has(entry.path);
    const children = childEntries.get(entry.path) || [];

    return (
      <FileRowWrapper key={entry.path}
        entry={entry}
        depth={depth}
        isExpanded={isExpanded}
        childrenEntries={children}
        isSelected={selectedPath === entry.path}
        editing={editingPath === entry.path}
        handleRenameCommit={handleRenameCommit}
        handleRenameCancel={handleRenameCancel}
        handleClick={handleClick}
        handleDoubleClick={handleDoubleClick}
        handleContextMenu={handleContextMenu}
        renderEntry={renderEntry}
      />
    );
  };

  return (
    <div
      className="flex-1 overflow-y-auto overflow-x-auto outline-none"
      tabIndex={0}
      onContextMenu={handleEmptyContextMenu}
      onKeyDown={handleKeyDown}
      onClick={(e) => { if (e.target === e.currentTarget && !contextMenu && !emptyContextMenu) setSelectedPath(''); }}
    >
      {openError && (
        <div className="px-3 py-2 text-xs text-yellow-400 bg-yellow-400/5 border-b border-yellow-400/20">
          {openError}
        </div>
      )}
      {entries.map((entry) => renderEntry(entry, 0))}
      {entries.length === 0 && (
        <div className="p-4 text-center text-text-tertiary text-xs">
          此目录为空
        </div>
      )}

      {/* 右键菜单（文件/目录） */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={buildMenuItems(contextMenu.entry)}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* 右键菜单（空白区域） */}
      {emptyContextMenu && (
        <ContextMenu
          x={emptyContextMenu.x}
          y={emptyContextMenu.y}
          items={[
            {
              label: '新建文件', icon: <VscNewFile size={14} />,
              onClick: () => handleNewFile(currentPath, emptyContextMenu.x, emptyContextMenu.y),
            },
            {
              label: '新建文件夹', icon: <VscNewFolder size={14} />,
              onClick: () => handleNewFolder(currentPath),
            },
            ...(useFileClipboardStore.getState().hasEntries ? [{
              label: '粘贴', icon: <VscFile size={14} />,
              onClick: () => handlePasteFile(currentPath),
            } as ContextMenuItem] : []),
            { divider: true, label: '', onClick: () => {} },
            {
              label: '刷新', icon: <VscRefresh size={14} />,
              onClick: () => triggerRefresh(),
            },
          ]}
          onClose={() => setEmptyContextMenu(null)}
        />
      )}

      {/* Feature #2: 新建文件类型选择器 */}
      {showTypePicker && (
        <NewFileTypePicker
          x={showTypePicker.x}
          y={showTypePicker.y}
          onSelect={handleFileTypeSelected}
          onClose={() => setShowTypePicker(null)}
        />
      )}
    </div>
  );
}
