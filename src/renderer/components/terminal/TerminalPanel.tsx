import { useEffect, useCallback, useRef, useState } from 'react';
import { VscTerminal, VscClose, VscCopy } from 'react-icons/vsc';
import { XTerm, type XTermHandle } from './XTerm';
import { TerminalTabs } from './TerminalTabs';
import { NewTerminalDialog } from './NewTerminalDialog';
import { DraggablePanelHeader } from '../layout/DraggablePanelHeader';
import { useProjectStore } from '../../stores/useProjectStore';
import { useTerminalStore } from '../../stores/useTerminalStore';
import { useLayoutStore } from '../../stores/useLayoutStore';

export function TerminalPanel() {
  const projectPath = useProjectStore((s) => s.projectPath);
  const switchTrigger = useProjectStore((s) => s.switchTrigger);
  const { tabs, activeId, counter, setActiveId, addTab, removeTab, renameTab, incrementCounter, resetAll } =
    useTerminalStore();
  const showTerminal = useLayoutStore((s) => s.showTerminal);
  const [showNewTermDialog, setShowNewTermDialog] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const xtermRef = useRef<XTermHandle>(null);

  // 终端焦点保障：面板可见+activeId变化时，多阶段聚焦确保可输入
  // 同时注册全局 focus 到 store，供外部调用（如 PanelResizer 拖拽结束、拖拽排序结束）
  useEffect(() => {
    const store = useTerminalStore.getState();
    store.setFocusFn(() => {
      requestAnimationFrame(() => {
        xtermRef.current?.focus();
      });
    });
    return () => { store.setFocusFn(null); };
  }, []);

  useEffect(() => {
    if (showTerminal && activeId) {
      // 阶段1：立即聚焦
      requestAnimationFrame(() => xtermRef.current?.focus());
      // 阶段2：延迟聚焦兜底（xterm.js fit 完成或布局动画结束后）
      const t1 = setTimeout(() => xtermRef.current?.focus(), 100);
      const t2 = setTimeout(() => xtermRef.current?.focus(), 300);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
  }, [showTerminal, activeId]);

  const createTerminal = useCallback(async (opts?: { command?: string; label?: string }) => {
    if (!projectPath) return;
    try {
      const sessionId = await window.electronAPI.terminal.create({
        cwd: projectPath,
        cols: 120,
        rows: 30,
        command: opts?.command,
      });
      const label = opts?.label ?? (counter === 1 ? 'Claude' : `终端 ${counter}`);
      addTab({ id: sessionId, label });
      incrementCounter();
    } catch (err) {
      console.error('创建终端会话失败:', err);
    }
  }, [projectPath, counter, addTab, incrementCounter]);

  const handleNewTerminalConfirm = useCallback((command: string, label: string) => {
    createTerminal({ command, label });
    setShowNewTermDialog(false);
  }, [createTerminal]);

  // 首次加载时自动创建 opencode 终端，Claude 延迟 3s 后创建
  const initTerminals = useCallback(async () => {
    await createTerminal({ command: 'opencode', label: 'Opencode' });
    setTimeout(() => createTerminal({ command: 'claude', label: 'Claude' }), 3000);
  }, [createTerminal]);

  useEffect(() => {
    if (projectPath && tabs.length === 0) {
      initTerminals();
    }
  }, [projectPath, tabs.length, initTerminals]);

  // 项目切换（Ctrl+Shift+P）时：杀掉所有旧会话，重置后 effect 自动重建双终端
  const prevSwitchTrigger = useRef(switchTrigger);
  useEffect(() => {
    if (switchTrigger > 0 && switchTrigger !== prevSwitchTrigger.current) {
      prevSwitchTrigger.current = switchTrigger;
      // 杀掉所有现有 PTY 会话
      const currentTabs = useTerminalStore.getState().tabs;
      currentTabs.forEach((tab) => {
        window.electronAPI.terminal.kill(tab.id);
      });
      // 重置 store（tabs 清空后上方的 effect 会自动创建双终端）
      resetAll();
    }
  }, [switchTrigger, resetAll]);

  const handleRename = useCallback(async (id: string, label: string) => {
    await (window.electronAPI as any).terminal.rename(id, label);
    renameTab(id, label);
  }, [renameTab]);

  const handleClose = (id: string) => {
    window.electronAPI.terminal.kill(id);
    removeTab(id);
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    const mh = 90, mw = 140;
    let x = e.clientX, y = e.clientY;
    if (y + mh > window.innerHeight) y -= mh;
    if (x + mw > window.innerWidth) x -= mw;
    setContextMenu({ x, y });
  };

  const handleContextMenuCopy = () => {
    xtermRef.current?.copySelection();
    setContextMenu(null);
  };

  const handleContextMenuPaste = () => {
    xtermRef.current?.pasteClipboard();
    setContextMenu(null);
  };

  return (
    <div
      className="h-full flex flex-col glass-panel overflow-hidden"
      onClick={() => {
        // 点击终端面板任意位置 → 多阶段聚焦，确保布局动画后也能输入
        requestAnimationFrame(() => xtermRef.current?.focus());
        setTimeout(() => xtermRef.current?.focus(), 100);
      }}
    >
      <DraggablePanelHeader panelId="terminal" className="flex items-center justify-between px-3 py-2 border-b border-border-subtle flex-shrink-0">
        <div className="flex items-center gap-2">
          <VscTerminal size={15} className="text-accent" />
          <span className="text-xs font-medium text-text-secondary">终端</span>
        </div>
        <button
          onClick={() => useLayoutStore.getState().setShowTerminal(false)}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-red-500/20 text-text-secondary hover:text-red-400 transition-colors"
          title="关闭终端"
        >
          <VscClose size={16} />
        </button>
      </DraggablePanelHeader>

      <TerminalTabs
        tabs={tabs.map((t) => ({ ...t, isActive: t.id === activeId }))}
        onSelect={setActiveId}
        onClose={handleClose}
        onAdd={() => setShowNewTermDialog(true)}
        onRename={handleRename}
        onEditCommitted={() => {
          // 重命名完成后重新聚焦终端，确保输入不丢失
          setTimeout(() => xtermRef.current?.focus(), 50);
        }}
      />

      <div
        className="flex-1 overflow-hidden relative flex flex-col"
        onContextMenu={handleContextMenu}
      >
        {activeId ? (
          <XTerm key={activeId} ref={xtermRef} sessionId={activeId} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-text-tertiary text-sm">
            点击 + 新建终端
          </div>
        )}

        {/* 右键菜单 */}
        {contextMenu && (
          <div
            className="fixed inset-0 z-50"
            onClick={() => setContextMenu(null)}
            onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
          >
            <div
              className="absolute bg-bg-raised border border-border-subtle rounded-lg shadow-xl py-1 min-w-[140px]"
              style={{ left: contextMenu.x, top: contextMenu.y }}
            >
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover cursor-pointer"
                onClick={handleContextMenuCopy}
              >
                <VscCopy size={14} /> 复制
              </button>
              <button
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-primary hover:bg-bg-hover cursor-pointer"
                onClick={handleContextMenuPaste}
              >
                粘贴
              </button>
            </div>
          </div>
        )}
      </div>

      {showNewTermDialog && (
        <NewTerminalDialog
          onConfirm={handleNewTerminalConfirm}
          onCancel={() => setShowNewTermDialog(false)}
        />
      )}
    </div>
  );
}
