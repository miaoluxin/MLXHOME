import { useEffect, useState, useRef } from 'react';
import { VscSymbolRuler, VscClose, VscFolder, VscFile, VscEdit, VscCopy, VscTrash, VscNewFile, VscNewFolder, VscRefresh, VscArrowLeft, VscSave, VscDiscard, VscFolderOpened } from 'react-icons/vsc';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useLayoutStore } from '../../stores/useLayoutStore';
import { usePromptStore } from '../../stores/usePromptStore';
import { ContextMenu, type ContextMenuItem } from '../filesystem/ContextMenu';

export function PromptManager() {
  const { entries, selectedPath, selectedContent, selectedTitle, editContent, view, loadTree, selectPrompt, saveEdit, startEdit, cancelEdit, setEditContent, goBack, createPrompt, createFolder, deletePrompt, renamePrompt } = usePromptStore();
  const [promptsDir, setPromptsDir] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; entry?: { name: string; path: string; isDirectory: boolean } } | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [childMap, setChildMap] = useState<Map<string, Array<{ name: string; path: string; isDirectory: boolean }>>>(new Map());
  const editRef = useRef<HTMLTextAreaElement>(null);

  const loadChildren = async (dirPath: string) => {
    try {
      const list = await window.electronAPI.fs.list(dirPath);
      setChildMap(prev => new Map(prev).set(dirPath, list));
    } catch { /* ignore */ }
  };

  useEffect(() => {
    window.electronAPI.prompts.getDir().then((dir) => {
      setPromptsDir(dir);
      loadTree(dir);
    });
  }, []);

  const toggleDir = (dirPath: string) => {
    const next = new Set(expandedDirs);
    if (next.has(dirPath)) {
      next.delete(dirPath);
    } else {
      next.add(dirPath);
      loadChildren(dirPath);
    }
    setExpandedDirs(next);
  };

  const handleEntryClick = (entry: { name: string; path: string; isDirectory: boolean }) => {
    if (entry.isDirectory) {
      toggleDir(entry.path);
    } else if (entry.name.endsWith('.md')) {
      selectPrompt(entry.path);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, entry?: { name: string; path: string; isDirectory: boolean }) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, entry });
  };

  const handleEmptyContextMenu = (e: React.MouseEvent) => {
    if (e.target !== e.currentTarget) return;
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRename = async (oldPath: string) => {
    const oldName = oldPath.split('/').pop() || oldPath.split('\\').pop() || '';
    const newName = prompt('重命名:', oldName);
    if (!newName || newName === oldName) return;
    const ok = await renamePrompt(oldPath, newName);
    if (ok) refreshAll();
  };

  const refreshAll = async () => {
    if (promptsDir) loadTree(promptsDir);
    for (const d of expandedDirs) await loadChildren(d);
  };

  const handleDelete = async (filePath: string) => {
    const ok = await deletePrompt(filePath);
    if (ok) {
      if (selectedPath === filePath) goBack();
      refreshAll();
    }
  };

  const buildMenuItems = (entry?: { name: string; path: string; isDirectory: boolean }): ContextMenuItem[] => {
    if (entry?.isDirectory) {
      return [
        { label: '新建提示词', icon: <VscNewFile size={14} />, onClick: async () => { const r = await createPrompt(entry.path); if (r) refreshAll(); } },
        { label: '新建分组', icon: <VscNewFolder size={14} />, onClick: async () => { const r = await createFolder(entry.path); if (r) refreshAll(); } },
        { divider: true, label: '', onClick: () => {} },
        { label: '重命名', icon: <VscEdit size={14} />, onClick: () => handleRename(entry.path) },
        { label: '删除', icon: <VscTrash size={14} />, onClick: () => handleDelete(entry.path) },
      ];
    }
    if (entry) {
      return [
        { label: '重命名', icon: <VscEdit size={14} />, onClick: () => handleRename(entry.path) },
        { label: '删除', icon: <VscTrash size={14} />, onClick: () => handleDelete(entry.path) },
        { divider: true, label: '', onClick: () => {} },
        { label: '复制路径', icon: <VscCopy size={14} />, onClick: () => navigator.clipboard.writeText(entry.path) },
      ];
    }
    return [
      { label: '新建提示词', icon: <VscNewFile size={14} />, onClick: async () => { const r = await createPrompt(promptsDir); if (r) refreshAll(); } },
      { label: '新建分组', icon: <VscNewFolder size={14} />, onClick: async () => { const r = await createFolder(promptsDir); if (r) refreshAll(); } },
      { divider: true, label: '', onClick: () => {} },
      { label: '刷新', icon: <VscRefresh size={14} />, onClick: () => refreshAll() },
    ];
  };

  const renderTree = (items: Array<{ name: string; path: string; isDirectory: boolean }>, depth = 0) => {
    return items.map((entry) => {
      const isExpanded = expandedDirs.has(entry.path);
      const children = childMap.get(entry.path) || [];
      const displayName = entry.isDirectory ? entry.name : entry.name.replace(/\.md$/i, '');
      return (
        <div key={entry.path}>
          <div
            className={`file-row flex items-center gap-2 px-3 py-1.5 cursor-pointer text-xs select-none ${selectedPath === entry.path ? 'bg-accent/15 text-text-primary' : 'text-text-secondary hover:bg-bg-hover'}`}
            style={{ paddingLeft: 8 + depth * 16 }}
            onClick={() => handleEntryClick(entry)}
            onContextMenu={(e) => handleContextMenu(e, entry)}
          >
            {entry.isDirectory ? (
              <span className="flex-shrink-0">{isExpanded ? <VscFolderOpened size={14} className="text-yellow-500" /> : <VscFolder size={14} className="text-yellow-500" />}</span>
            ) : (
              <VscFile size={14} className="text-blue-400 flex-shrink-0" />
            )}
            <span className="flex-1 truncate">{displayName}</span>
          </div>
          {entry.isDirectory && isExpanded && children.length > 0 && (
            <div>{renderTree(children, depth + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (view === 'detail' || view === 'edit') {
    return (
      <div className="h-full flex flex-col glass-panel overflow-hidden">
        <DraggablePanelHeader panelId="prompts" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <VscSymbolRuler size={15} className="text-accent flex-shrink-0" />
            <span className="text-xs font-medium text-text-secondary truncate">{selectedTitle || '提示词'}</span>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={goBack} className="w-6 h-6 flex items-center justify-center rounded hover:bg-bg-hover text-text-secondary hover:text-text-primary transition-colors" title="返回列表">
              <VscArrowLeft size={14} />
            </button>
            <button onClick={() => useLayoutStore.getState().setShowPrompts(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors" title="关闭">
              <VscClose size={16} />
            </button>
          </div>
        </DraggablePanelHeader>

        {view === 'edit' ? (
          <>
            <textarea
              ref={editRef}
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="flex-1 w-full bg-bg-base text-text-primary text-xs font-mono p-3 outline-none resize-none border-0"
              spellCheck={false}
            />
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle bg-bg-deep flex-shrink-0">
              <button onClick={saveEdit} className="flex items-center gap-1 px-3 py-1 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">
                <VscSave size={12} /> 保存
              </button>
              <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">
                <VscDiscard size={12} /> 取消
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="text-xs text-text-primary whitespace-pre-wrap break-words leading-relaxed">{selectedContent}</div>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 border-t border-border-subtle bg-bg-deep flex-shrink-0">
              <button onClick={startEdit} className="flex items-center gap-1 px-3 py-1 text-xs bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">
                <VscEdit size={12} /> 编辑
              </button>
              <button onClick={() => { navigator.clipboard.writeText(selectedContent); }} className="flex items-center gap-1 px-3 py-1 text-xs text-text-secondary hover:text-text-primary transition-colors">
                <VscCopy size={12} /> 复制
              </button>
              {selectedPath && (
                <button onClick={() => handleDelete(selectedPath)} className="flex items-center gap-1 px-3 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded transition-colors ml-auto">
                  <VscTrash size={12} /> 删除
                </button>
              )}
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col glass-panel overflow-hidden">
      <DraggablePanelHeader panelId="prompts" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscSymbolRuler size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">提示词</span>
          <span className="text-[10px] text-text-tertiary">({entries.length > 0 ? entries.filter(e => !e.isDirectory).length : '...'})</span>
        </div>
        <button onClick={() => useLayoutStore.getState().setShowPrompts(false)} className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors" title="关闭">
          <VscClose size={16} />
        </button>
      </DraggablePanelHeader>

      <div className="flex-1 overflow-y-auto" onContextMenu={handleEmptyContextMenu}>
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-xs text-text-tertiary gap-2">
            <span>暂无提示词</span>
            <div className="flex gap-2">
              <button onClick={async () => { const r = await createPrompt(promptsDir); if (r) refreshAll(); }}
                className="px-3 py-1 bg-accent/10 text-accent rounded hover:bg-accent/20 transition-colors">新建提示词</button>
              <button onClick={async () => { const r = await createFolder(promptsDir); if (r) refreshAll(); }}
                className="px-3 py-1 bg-bg-raised text-text-secondary rounded hover:bg-bg-hover transition-colors">新建分组</button>
            </div>
          </div>
        ) : (
          renderTree(entries.filter(e => e.isDirectory))
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x} y={contextMenu.y}
          items={buildMenuItems(contextMenu.entry)}
          onClose={() => setContextMenu(null)}
        />
      )}

      <div className="flex items-center gap-1 px-3 py-1.5 border-t border-border-subtle bg-bg-deep text-[10px] text-text-tertiary">
        <button onClick={async () => { const r = await createPrompt(promptsDir); if (r) refreshAll(); }}
          className="flex items-center gap-1 px-2 py-0.5 hover:text-text-primary transition-colors" title="新建提示词">
          <VscNewFile size={12} /> 新建
        </button>
        <span className="text-border-subtle">|</span>
        <button onClick={async () => { const r = await createFolder(promptsDir); if (r) refreshAll(); }}
          className="flex items-center gap-1 px-2 py-0.5 hover:text-text-primary transition-colors" title="新建分组">
          <VscNewFolder size={12} /> 分组
        </button>
        <span className="text-border-subtle">|</span>
        <button onClick={() => refreshAll()}
          className="flex items-center gap-1 px-2 py-0.5 hover:text-text-primary transition-colors" title="刷新">
          <VscRefresh size={12} /> 刷新
        </button>
      </div>
    </div>
  );
}
